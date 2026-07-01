use crate::types::ShopSession;
use crate::valorant;

#[tauri::command]
async fn token_login(access_token: String, region: Option<String>) -> Result<ShopSession, String> {
    let normalized_token = valorant::normalize_access_token(&access_token);
    if normalized_token.is_empty() {
        return Err("Paste an access_token, session id, or full redirect URL.".to_string());
    }
    let normalized_region = valorant::normalize_region(region)?;

    let client = valorant::build_client()?;
    valorant::load_session_from_access_token(&client, &normalized_token, normalized_region)
        .await
        .map_err(String::from)
}

pub fn register(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(tauri::generate_handler![token_login])
}
