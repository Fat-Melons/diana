// Prevent console window from appearing on Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod riot;
mod db_proxy;
mod match_summary;
mod sync;

use anyhow::Result;
use models::{PlayerOverview, PlayerQuery, MatchQuery, MatchDetails, ActivityQuery, DailyActivityEntry};

#[tauri::command]
async fn get_player_overview(query: PlayerQuery) -> Result<PlayerOverview, String> {
    let call_id = uuid::Uuid::new_v4();
    eprintln!("[MAIN] get_player_overview START {call_id} for player: {}#{} region: {}", query.name, query.tag, query.region);
    eprintln!("[MAIN] If you see this log but no [SYNC] logs, there's an issue in sync.rs");
    let out = async {
        let client = reqwest::Client::builder().user_agent("Diana/0.1.0").build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
        
        let proxy_available = riot::check_proxy_connectivity(&client)
            .await
            .map_err(|e| format!("Failed to check proxy connectivity: {}", e))?;
        
        if !proxy_available {
            return Err("Proxy server is not available. Please start the diana-proxy server.".to_string());
        }
        
        let pool = db_proxy::init_pool().await.map_err(|e| e.to_string())?;
        sync::sync_player_and_get_overview(&pool, &query.region, &query.name, &query.tag, "")
            .await
            .map_err(|e| e.to_string())
    }
    .await;
    match &out {
        Ok(overview) => {
            eprintln!("[MAIN] get_player_overview END {call_id} SUCCESS: {} matches returned", overview.matches.len());
            if overview.matches.is_empty() {
                eprintln!("[MAIN] ❌ PROBLEM: Overview successful but contains 0 matches!");
            } else {
                eprintln!("[MAIN] ✅ Overview contains {} matches: {:?}", overview.matches.len(), 
                         overview.matches.iter().take(3).map(|m| &m.match_id).collect::<Vec<_>>());
            }
        }
        Err(e) => {
            eprintln!("[MAIN] get_player_overview END {call_id} FAILED: {}", e);
        }
    }
    out
}

#[tauri::command]
async fn get_match_details(query: MatchQuery) -> Result<MatchDetails, String> {
    let call_id = uuid::Uuid::new_v4();
    eprintln!("get_match_details START {call_id} match_id={}", query.match_id);
    let out = async {
        let client = reqwest::Client::builder().user_agent("Diana/0.1.0").build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
        
        let proxy_available = riot::check_proxy_connectivity(&client)
            .await
            .map_err(|e| format!("Failed to check proxy connectivity: {}", e))?;
        
        if !proxy_available {
            return Err("Proxy server is not available. Please start the diana-proxy server.".to_string());
        }
        
        let pool = db_proxy::init_pool().await.map_err(|e| e.to_string())?;
        let ddragon_version = riot::get_latest_ddragon_version(&client)
            .await
            .map_err(|e| e.to_string())?;
        
        let user_region = "EUW";
        let (_, regional) = riot::map_region(user_region)
            .ok_or_else(|| "Invalid user region".to_string())?;
        
        db_proxy::get_match_details_from_db(
            &pool,
            &query.match_id,
            &query.user_puuid,
            &ddragon_version,
            &client,
            "",
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
        let pool = db_proxy::init_pool().await.map_err(|e| e.to_string())?;
        db_proxy::get_daily_activity(&pool, &query.user_puuid)
            .await
            .map_err(|e| e.to_string())
    }
    .await;
    eprintln!("get_daily_activity END {call_id} ok={}", out.is_ok());
    out
}

pub fn main() {
    // Load environment variables from .env file if present (for development)
    dotenvy::dotenv().ok();
    
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_player_overview, get_match_details, get_daily_activity])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
