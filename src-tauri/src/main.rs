#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod models;
mod riot;
mod db;
mod match_summary;
mod sync;

use anyhow::Result;
use models::{PlayerOverview, PlayerQuery};
use uuid::Uuid;

#[tauri::command]
async fn get_player_overview(query: PlayerQuery) -> Result<PlayerOverview, String> {
    let call_id = uuid::Uuid::new_v4();
    eprintln!("get_player_overview START {call_id} {:?}", query);
    let out = async {
        dotenvy::dotenv().ok();
        let api_key = std::env::var("RIOT_API_KEY").map_err(|_| "RIOT_API_KEY not set".to_string())?;
        let pool = db::init_pool().await.map_err(|e| e.to_string())?;
        sync::sync_player_and_get_overview(&pool, &query.region, &query.name, &query.tag, &api_key).await
            .map_err(|e| e.to_string())
    }.await;
    eprintln!("get_player_overview END {call_id} ok={}", out.is_ok());
    out
}

pub fn main() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_player_overview])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
