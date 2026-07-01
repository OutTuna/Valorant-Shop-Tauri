use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ShopItem {
    pub uuid: String,
    pub name: String,
    pub image: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<i64>,
    pub remaining: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_price: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discounted_price: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub discount_percent: Option<i64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct Player {
    pub puuid: String,
    pub name: String,
    pub tag: String,
    pub vp: i64,
}

#[derive(Serialize, Clone, Debug)]
pub struct Shop {
    pub daily: Vec<ShopItem>,
    pub night: Vec<ShopItem>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ShopSession {
    pub player: Player,
    pub region: String,
    pub shop: Shop,
}

#[derive(Clone, Debug)]
pub struct SkinInfo {
    pub uuid: String,
    pub name: String,
    pub image: String,
}
