use std::collections::HashMap;
use std::time::Duration;

use futures::future::join_all;
use reqwest::{header::HeaderMap, Client};
use serde_json::Value;

use crate::error::{RiotError, RiotResult};
use crate::types::{Player, Shop, ShopItem, ShopSession, SkinInfo};

const VALORANT_API: &str = "https://valorant-api.com/v1";
const USERINFO_URL: &str = "https://auth.riotgames.com/userinfo";
const ENTITLEMENTS_URL: &str = "https://entitlements.auth.riotgames.com/api/token/v1";
const RIOT_USER_AGENT: &str =
    "RiotClient/99.0.4.202.816 rso-auth/2 riotgames/pcac (Windows;10;;Professional, x64)";
const REGIONS: [&str; 6] = ["eu", "na", "ap", "kr", "latam", "br"];
const VP_CURRENCY_ID: &str = "85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741";

const CLIENT_PLATFORM: &str = "eyJwbGF0Zm9ybVR5cGUiOiJQQyIsInBsYXRmb3JtT1MiOiJXaW5kb3dzIiwicGxhdGZvcm1PU1ZlcnNpb24iOiIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwicGxhdGZvcm1DaGlwc2V0IjoiVW5rbm93biJ9";

pub fn normalize_region(value: Option<String>) -> RiotResult<Option<String>> {
    let Some(raw) = value else { return Ok(None) };
    let normalized = raw.trim().to_lowercase();
    if normalized.is_empty() || normalized == "auto" {
        return Ok(None);
    }
    if !REGIONS.contains(&normalized.as_str()) {
        return Err(RiotError::Auth(
            "region must be auto, eu, na, ap, kr, latam, or br".to_string(),
        ));
    }
    Ok(Some(normalized))
}


pub fn normalize_access_token(value: &str) -> String {
    let candidate = value.trim();
    if !candidate.contains("access_token=") {
        return candidate.to_string();
    }
    candidate
        .split("access_token=")
        .nth(1)
        .map(|rest| rest.split('&').next().unwrap_or(rest).to_string())
        .unwrap_or_else(|| candidate.to_string())
}

pub fn build_client() -> RiotResult<Client> {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(RiotError::from)
}

fn first_value(map: &Value) -> i64 {
    map.as_object()
        .and_then(|obj| obj.values().next())
        .and_then(|v| v.as_i64())
        .unwrap_or(0)
}

fn extract_affinity(userinfo: &Value) -> Option<String> {
    let affinity = userinfo.get("affinity")?;
    if let Some(obj) = affinity.as_object() {
        for key in ["pp", "region", "shard"] {
            if let Some(value) = obj.get(key).and_then(|v| v.as_str()) {
                if !value.is_empty() {
                    return Some(value.trim().to_lowercase());
                }
            }
        }
        return None;
    }
    affinity
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| s.trim().to_lowercase())
}

async fn fetch_userinfo(client: &Client, access_token: &str) -> RiotResult<Value> {
    let response = client
        .get(USERINFO_URL)
        .bearer_auth(access_token)
        .header("Accept", "application/json")
        .header("User-Agent", RIOT_USER_AGENT)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(RiotError::Auth(format!(
            "Could not read Riot profile data ({}).",
            response.status()
        )));
    }
    response.json::<Value>().await.map_err(RiotError::from)
}

async fn fetch_entitlements(client: &Client, access_token: &str) -> RiotResult<String> {
    let response = client
        .post(ENTITLEMENTS_URL)
        .bearer_auth(access_token)
        .json(&serde_json::json!({}))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(RiotError::Auth(
            "Could not create Riot entitlements token.".to_string(),
        ));
    }
    let payload: Value = response.json().await?;
    payload
        .get("entitlements_token")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| RiotError::Auth("Riot did not return an entitlements token.".to_string()))
}

async fn get_client_version(client: &Client) -> String {
    let fallback = "release-10.00-shipping-15-2704372".to_string();
    let Ok(response) = client.get(format!("{VALORANT_API}/version")).send().await else {
        return fallback;
    };
    if !response.status().is_success() {
        return fallback;
    }
    let Ok(payload) = response.json::<Value>().await else {
        return fallback;
    };
    payload["data"]["riotClientVersion"]
        .as_str()
        .map(str::to_string)
        .unwrap_or(fallback)
}

fn riot_headers(access_token: &str, entitlements_token: &str, client_version: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        format!("Bearer {access_token}").parse().unwrap(),
    );
    headers.insert("X-Riot-Entitlements-JWT", entitlements_token.parse().unwrap());
    headers.insert("X-Riot-ClientPlatform", CLIENT_PLATFORM.parse().unwrap());
    headers.insert("X-Riot-ClientVersion", client_version.parse().unwrap());
    headers.insert("Content-Type", "application/json".parse().unwrap());
    headers
}

async fn fetch_storefront(client: &Client, region: &str, puuid: &str, headers: &HeaderMap) -> Value {
    let v3_url = format!("https://pd.{region}.a.pvp.net/store/v3/storefront/{puuid}");
    if let Ok(response) = client.post(&v3_url).headers(headers.clone()).body("{}").send().await {
        if response.status().is_success() {
            if let Ok(json) = response.json::<Value>().await {
                return json;
            }
        }
    }

    let v2_url = format!("https://pd.{region}.a.pvp.net/store/v2/storefront/{puuid}");
    if let Ok(response) = client.get(&v2_url).headers(headers.clone()).send().await {
        if response.status().is_success() {
            if let Ok(json) = response.json::<Value>().await {
                return json;
            }
        }
    }

    Value::Object(Default::default())
}

async fn fetch_wallet(client: &Client, region: &str, puuid: &str, headers: &HeaderMap) -> Value {
    let url = format!("https://pd.{region}.a.pvp.net/store/v1/wallet/{puuid}");
    let Ok(response) = client.get(&url).headers(headers.clone()).send().await else {
        return Value::Object(Default::default());
    };
    if !response.status().is_success() {
        return Value::Object(Default::default());
    }
    response.json::<Value>().await.unwrap_or(Value::Object(Default::default()))
}

async fn fetch_offer_prices(client: &Client, region: &str, headers: &HeaderMap) -> HashMap<String, i64> {
    let url = format!("https://pd.{region}.a.pvp.net/store/v1/offers/");
    let Ok(response) = client.get(&url).headers(headers.clone()).send().await else {
        return HashMap::new();
    };
    if !response.status().is_success() {
        return HashMap::new();
    }
    let Ok(payload) = response.json::<Value>().await else {
        return HashMap::new();
    };

    let mut prices = HashMap::new();
    if let Some(offers) = payload.get("Offers").and_then(|v| v.as_array()) {
        for offer in offers {
            if let Some(id) = offer.get("OfferID").and_then(|v| v.as_str()) {
                let cost = offer.get("Cost").cloned().unwrap_or(Value::Null);
                prices.insert(id.to_string(), first_value(&cost));
            }
        }
    }
    prices
}

fn extract_prices_from_storefront(storefront: &Value) -> HashMap<String, i64> {
    let mut prices = HashMap::new();
    let Some(offers) = storefront["SkinsPanelLayout"]["SingleItemStoreOffers"].as_array() else {
        return prices;
    };
    for offer in offers {
        let Some(id) = offer.get("OfferID").and_then(|v| v.as_str()) else {
            continue;
        };
        let cost = offer.get("Cost").cloned().unwrap_or(Value::Null);
        let price = first_value(&cost);
        if price != 0 {
            prices.insert(id.to_string(), price);
        }
    }
    prices
}

async fn skin_catalog(client: &Client, skin_uuid: &str) -> SkinInfo {
    let fallback_image = format!("https://media.valorant-api.com/weaponskinlevels/{skin_uuid}/displayicon.png");
    let url = format!("{VALORANT_API}/weapons/skinlevels/{skin_uuid}");

    if let Ok(response) = client.get(&url).send().await {
        if response.status().is_success() {
            if let Ok(payload) = response.json::<Value>().await {
                let data = &payload["data"];
                let name = data["displayName"].as_str().unwrap_or(skin_uuid).to_string();
                let image = data["displayIcon"].as_str().map(str::to_string).unwrap_or(fallback_image);
                return SkinInfo { uuid: skin_uuid.to_string(), name, image };
            }
        }
    }

    SkinInfo {
        uuid: skin_uuid.to_string(),
        name: skin_uuid.to_string(),
        image: fallback_image,
    }
}

async fn resolve_region(
    client: &Client,
    preferred: Option<&str>,
    puuid: &str,
    headers: &HeaderMap,
) -> RiotResult<(String, Value)> {
    if let Some(region) = preferred {
        let probe = fetch_storefront(client, region, puuid, headers).await;
        if probe.as_object().map(|o| !o.is_empty()).unwrap_or(false) {
            return Ok((region.to_string(), probe));
        }
        return Err(RiotError::Auth(format!(
            "Store is not available for region '{region}'."
        )));
    }

    for region in REGIONS {
        let probe = fetch_storefront(client, region, puuid, headers).await;
        if probe.as_object().map(|o| !o.is_empty()).unwrap_or(false) {
            return Ok((region.to_string(), probe));
        }
    }

    Err(RiotError::Upstream("Could not detect the account region.".to_string()))
}

fn format_daily_offers(
    storefront: &Value,
    prices: &HashMap<String, i64>,
    skins: &HashMap<String, SkinInfo>,
) -> Vec<ShopItem> {
    let panel = &storefront["SkinsPanelLayout"];
    let remaining = panel["SingleItemOffersRemainingDurationInSeconds"].as_i64().unwrap_or(0);

    let Some(offer_ids) = panel["SingleItemOffers"].as_array() else {
        return Vec::new();
    };

    offer_ids
        .iter()
        .filter_map(|v| v.as_str())
        .map(|offer_id| {
            let skin = skins.get(offer_id);
            ShopItem {
                uuid: offer_id.to_string(),
                name: skin.map(|s| s.name.clone()).unwrap_or_else(|| offer_id.to_string()),
                image: skin.map(|s| s.image.clone()).unwrap_or_default(),
                price: Some(*prices.get(offer_id).unwrap_or(&0)),
                remaining,
                original_price: None,
                discounted_price: None,
                discount_percent: None,
            }
        })
        .collect()
}

fn format_night_market(storefront: &Value, skins: &HashMap<String, SkinInfo>) -> Vec<ShopItem> {
    let bonus = &storefront["BonusStore"];
    if bonus.is_null() {
        return Vec::new();
    }
    let remaining = bonus["BonusStoreRemainingDurationInSeconds"].as_i64().unwrap_or(0);

    let Some(offers) = bonus["BonusStoreOffers"].as_array() else {
        return Vec::new();
    };

    offers
        .iter()
        .filter_map(|item| {
            let offer = &item["Offer"];
            let offer_id = offer["OfferID"].as_str()?;
            let skin = skins.get(offer_id);
            let original_price = first_value(&offer["Cost"]);
            let discount_costs = &item["DiscountCosts"];
            let discounted_price = if discount_costs.is_object() && !discount_costs.as_object().unwrap().is_empty()
            {
                first_value(discount_costs)
            } else {
                original_price
            };

            Some(ShopItem {
                uuid: offer_id.to_string(),
                name: skin.map(|s| s.name.clone()).unwrap_or_else(|| offer_id.to_string()),
                image: skin.map(|s| s.image.clone()).unwrap_or_default(),
                price: None,
                remaining,
                original_price: Some(original_price),
                discounted_price: Some(discounted_price),
                discount_percent: Some(item["DiscountPercent"].as_i64().unwrap_or(0)),
            })
        })
        .collect()
}

async fn build_shop_payload(
    client: &Client,
    access_token: &str,
    entitlements_token: &str,
    puuid: &str,
    region: Option<&str>,
    player_name: &str,
    player_tag: &str,
) -> RiotResult<ShopSession> {
    let client_version = get_client_version(client).await;
    let headers = riot_headers(access_token, entitlements_token, &client_version);

    let (resolved_region, storefront) = resolve_region(client, region, puuid, &headers).await?;
    let wallet = fetch_wallet(client, &resolved_region, puuid, &headers).await;

    let mut prices = fetch_offer_prices(client, &resolved_region, &headers).await;
    if prices.is_empty() {
        prices = extract_prices_from_storefront(&storefront);
    }

    let mut skin_ids: Vec<String> = storefront["SkinsPanelLayout"]["SingleItemOffers"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
        .unwrap_or_default();

    if let Some(bonus_offers) = storefront["BonusStore"]["BonusStoreOffers"].as_array() {
        for item in bonus_offers {
            if let Some(id) = item["Offer"]["OfferID"].as_str() {
                if !skin_ids.contains(&id.to_string()) {
                    skin_ids.push(id.to_string());
                }
            }
        }
    }

    let skin_details: Vec<SkinInfo> =
        join_all(skin_ids.iter().map(|uuid| skin_catalog(client, uuid))).await;
    let skin_lookup: HashMap<String, SkinInfo> =
        skin_details.into_iter().map(|s| (s.uuid.clone(), s)).collect();

    let vp = wallet["Balances"][VP_CURRENCY_ID].as_i64().unwrap_or(0);

    Ok(ShopSession {
        player: Player {
            puuid: puuid.to_string(),
            name: player_name.to_string(),
            tag: if player_tag.is_empty() {
                String::new()
            } else {
                format!("#{player_tag}")
            },
            vp,
        },
        region: resolved_region,
        shop: Shop {
            daily: format_daily_offers(&storefront, &prices, &skin_lookup),
            night: format_night_market(&storefront, &skin_lookup),
        },
    })
}

pub async fn load_session_from_access_token(
    client: &Client,
    access_token: &str,
    region: Option<String>,
) -> RiotResult<ShopSession> {
    let userinfo = fetch_userinfo(client, access_token).await?;
    let entitlements_token = fetch_entitlements(client, access_token).await?;

    let puuid = userinfo["sub"]
        .as_str()
        .ok_or_else(|| RiotError::Auth("Riot profile did not include a PUUID.".to_string()))?
        .to_string();

    let affinity_region = extract_affinity(&userinfo);
    let preferred_region = region.or(affinity_region);

    let acct = &userinfo["acct"];
    let player_name = acct["game_name"]
        .as_str()
        .or_else(|| acct["gameName"].as_str())
        .unwrap_or("Riot Player")
        .to_string();
    let player_tag = acct["tag_line"]
        .as_str()
        .or_else(|| acct["tagLine"].as_str())
        .unwrap_or("")
        .to_string();

    build_shop_payload(
        client,
        access_token,
        &entitlements_token,
        &puuid,
        preferred_region.as_deref(),
        &player_name,
        &player_tag,
    )
    .await
}
