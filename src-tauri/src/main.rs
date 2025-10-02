mod models;
mod riot;
mod db;
mod match_summary;
mod sync;

use anyhow::Result;
use models::{PlayerOverview, PlayerQuery, MatchQuery, MatchDetails, ActivityQuery, DailyActivityEntry};

#[tauri::command]
async fn get_player_overview(query: PlayerQuery) -> Result<PlayerOverview, String> {
    let call_id = uuid::Uuid::new_v4();
    eprintln!("get_player_overview START {call_id} {:?}", query);
    let out = async {
        dotenvy::dotenv().ok();
        let api_key = std::env::var("RIOT_API_KEY").map_err(|_| "RIOT_API_KEY not set".to_string())?;
        let pool = db::init_pool().await.map_err(|e| e.to_string())?;
        sync::sync_player_and_get_overview(&pool, &query.region, &query.name, &query.tag, &api_key)
            .await
            .map_err(|e| e.to_string())
    }
    .await;
    eprintln!("get_player_overview END {call_id} ok={}", out.is_ok());
    out
}

#[tauri::command]
async fn get_match_details(query: MatchQuery) -> Result<MatchDetails, String> {
    let call_id = uuid::Uuid::new_v4();
    eprintln!("get_match_details START {call_id} match_id={}", query.match_id);
    let out = async {
        dotenvy::dotenv().ok();
        let api_key = std::env::var("RIOT_API_KEY").map_err(|_| "RIOT_API_KEY not set".to_string())?;
        let pool = db::init_pool().await.map_err(|e| e.to_string())?;
        let client = reqwest::Client::builder().user_agent("Diana/0.1.0").build()
            .map_err(|e| e.to_string())?;
        let ddragon_version = riot::get_latest_ddragon_version(&client)
            .await
            .map_err(|e| e.to_string())?;
        
        let user_region = "EUW";
        let (_, regional) = riot::map_region(user_region)
            .ok_or_else(|| "Invalid user region".to_string())?;
        
        match_summary::get_match_details_from_db(
            &pool,
            &query.match_id,
            &query.user_puuid,
            &ddragon_version,
            &client,
            &api_key,
            regional,
        )
        .await
        .map_err(|e| e.to_string())
    }
    .await;
    eprintln!("get_match_details END {call_id} ok={}", out.is_ok());
    out
}

#[tauri::command]
async fn get_daily_activity(query: ActivityQuery) -> Result<Vec<DailyActivityEntry>, String> {
    let call_id = uuid::Uuid::new_v4();
    eprintln!("get_daily_activity START {call_id} user_puuid={}", query.user_puuid);
    let out = async {
        dotenvy::dotenv().ok();
        let pool = db::init_pool().await.map_err(|e| e.to_string())?;
        db::get_daily_activity(&pool, &query.user_puuid)
            .await
            .map_err(|e| e.to_string())
    }
    .await;
    eprintln!("get_daily_activity END {call_id} ok={}", out.is_ok());
    out
}

pub fn main() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_player_overview, get_match_details, get_daily_activity])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}