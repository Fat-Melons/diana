use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use serde_json::Value;
use std::env;

use crate::models::{DbMatchRow, DbSummoner, RankStep};

/// Get the proxy base URL from runtime environment variable or compile-time default
pub fn proxy_base_url() -> String {
    // 1. Prefer runtime ENV for maximal flexibility
    if let Ok(url) = env::var("PROXY_URL") {
        return url;
    }
    // 2. Fallback to compile-time value set by build.rs
    env!("PROXY_BASE_URL").to_string()
}

/// Get the health check URL
pub fn proxy_health_url() -> String {
    format!("{}/health", proxy_base_url().trim_end_matches("/api"))
}

pub struct ProxyPool {
    client: Client,
}

pub struct ProxyTx {
    client: Client,
}

pub async fn init_pool() -> Result<ProxyPool> {
    let client = Client::builder().user_agent("Diana/0.1.0").build()?;
    
    let health_url = proxy_health_url();
    match client.get(&health_url).timeout(std::time::Duration::from_secs(5)).send().await {
        Ok(response) => {
            if response.status().is_success() {
                println!("[DbProxy] Database proxy is available");
            } else {
                return Err(anyhow!("Database proxy returned status {}", response.status()));
            }
        }
        Err(e) => {
            return Err(anyhow!("Failed to connect to database proxy: {}", e));
        }
    }
    
    Ok(ProxyPool { client })
}

pub async fn upsert_summoner(
    pool: &ProxyPool,
    puuid: &str,
    game_name: &str,
    tag_line: &str,
    region: &str,
    tier: Option<&str>,
    rank: Option<&str>,
    lp: Option<i32>,
) -> Result<()> {
    let url = format!("{}/db/summoners", proxy_base_url());
    
    let body = json!({
        "puuid": puuid,
        "gameName": game_name,
        "tagLine": tag_line,
        "region": region,
        "tier": tier,
        "rank": rank,
        "lp": lp
    });
    
    let response = pool.client
        .put(&url)
        .json(&body)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    Ok(())
}

pub async fn get_summoner(pool: &ProxyPool, puuid: &str) -> Result<Option<DbSummoner>> {
    let url = format!("{}/db/summoners/{}", proxy_base_url(), puuid);
    
    let response = pool.client.get(&url).send().await?;
    
    if response.status().as_u16() == 404 {
        return Ok(None);
    }
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    let text = response.text().await?;
    if text == "null" {
        return Ok(None);
    }
    
    let summoner: DbSummoner = serde_json::from_str(&text)?;
    Ok(Some(summoner))
}

pub async fn match_exists(pool: &ProxyPool, match_id: &str) -> Result<bool> {
    let url = format!("{}/db/matches/{}/exists", proxy_base_url(), match_id);
    
    let response = pool.client.get(&url).send().await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    #[derive(Deserialize)]
    struct ExistsResponse {
        exists: bool,
    }
    
    let result: ExistsResponse = response.json().await?;
    Ok(result.exists)
}

pub async fn latest_match_for_puuid(pool: &ProxyPool, puuid: &str) -> Result<Option<String>> {
    let url = format!("{}/db/matches/{}/latest", proxy_base_url(), puuid);
    
    let response = pool.client.get(&url).send().await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    let text = response.text().await?;
    if text == "null" {
        return Ok(None);
    }
    
    let match_row: DbMatchRow = serde_json::from_str(&text)?;
    Ok(Some(match_row.matchId))
}

pub async fn get_recent_matches(pool: &ProxyPool, puuid: &str, limit: i64) -> Result<Vec<DbMatchRow>> {
    let url = format!("{}/db/matches/{}/recent?limit={}", proxy_base_url(), puuid, limit);
    eprintln!("[DB_PROXY] ➡️  GET {} (puuid: {}, limit: {})", url, puuid, limit);
    
    let response = pool.client.get(&url).send().await?;
    eprintln!("[DB_PROXY] ⬅️  GET {} -> HTTP {}", url, response.status());
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        eprintln!("[DB_PROXY] ❌ Error response: {}", error_text);
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    let text = response.text().await?;
    eprintln!("[DB_PROXY] 📄 Response body (first 200 chars): {}", 
              text.chars().take(200).collect::<String>());
    
    let matches: Vec<DbMatchRow> = serde_json::from_str(&text)
        .map_err(|e| anyhow!("Failed to parse matches JSON: {} - Response was: {}", e, text))?;
    
    eprintln!("[DB_PROXY] ✅ Parsed {} matches successfully", matches.len());
    if !matches.is_empty() {
        eprintln!("[DB_PROXY] First match: id={}, creation={}", 
                  matches[0].matchId, matches[0].gameCreation);
    }
    
    Ok(matches)
}

pub async fn insert_match_details_tx(
    _tx: &mut ProxyTx,
    match_id: &str,
    entry_puuid: &str,
    game_version: Option<&str>,
    game_creation: Option<i64>,
    game_start: Option<i64>,
    game_end: Option<i64>,
    game_duration: Option<i32>,
    game_mode: Option<&str>,
    game_type: Option<&str>,
    queue_type: Option<i32>,
    map_name: Option<i32>,
    participants: &Value,
    teams: &Value,
) -> Result<i64> {
    let url = format!("{}/db/matches", proxy_base_url());
    
    let body = json!({
        "matchId": match_id,
        "entryPuuid": entry_puuid,
        "gameVersion": game_version,
        "gameCreation": game_creation,
        "gameStart": game_start,
        "gameEnd": game_end,
        "gameDuration": game_duration,
        "gameMode": game_mode,
        "gameType": game_type,
        "queueType": queue_type,
        "mapName": map_name,
        "participants": participants,
        "teams": teams
    });
    
    let response = _tx.client
        .post(&url)
        .json(&body)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    #[derive(Deserialize)]
    struct InsertResponse {
        mid: Option<i64>,
    }
    
    let result: InsertResponse = response.json().await?;
    let mid = result.mid.unwrap_or(0);
    
    if mid == 0 {
        eprintln!("[DB_PROXY] ❌ Match insertion returned mid=0 for match {}, this indicates a database issue", match_id);
        return Err(anyhow!("Match insertion failed: no mid returned for match {}", match_id));
    }
    
    eprintln!("[DB_PROXY] ✅ Match {} inserted/updated with mid: {}", match_id, mid);
    Ok(mid)
}

pub async fn insert_timeline_frame_tx(
    _tx: &mut ProxyTx,
    mid: i64,
    entry_participant_id: &str,
    frame_index: Option<i32>,
    timestamp: Option<i64>,
    participant_frames: &Value,
    events: &Value,
) -> Result<i64> {
    let url = format!("{}/db/timeline-frames", proxy_base_url());
    eprintln!("[DB_PROXY] ➡️  POST {} (mid: {}, participant: {}, frame: {:?})", 
              url, mid, entry_participant_id, frame_index);
    
    let body = json!({
        "mid": mid,
        "entryParticipantId": entry_participant_id,
        "frameIndex": frame_index,
        "timestamp": timestamp,
        "participantFrames": participant_frames,
        "events": events
    });
    
    let response = _tx.client
        .post(&url)
        .json(&body)
        .send()
        .await?;
    
    eprintln!("[DB_PROXY] ⬅️  POST {} -> HTTP {}", url, response.status());
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        eprintln!("[DB_PROXY] ❌ Timeline frame insertion failed: {}", error_text);
        return Err(anyhow!("Database proxy error for timeline frame: {}", error_text));
    }
    
    #[derive(Deserialize)]
    struct InsertResponse {
        tid: Option<i64>,
    }
    
    let result: InsertResponse = response.json().await?;
    Ok(result.tid.unwrap_or(0))
}

pub async fn timeline_frame_exists_tx(
    _tx: &mut ProxyTx,
    mid: i64,
    frame_index: i32,
) -> Result<bool> {
    let url = format!("{}/db/timeline-frames/{}/{}/exists", proxy_base_url(), mid, frame_index);
    
    let response = _tx.client.get(&url).send().await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    #[derive(Deserialize)]
    struct ExistsResponse {
        exists: bool,
    }
    
    let result: ExistsResponse = response.json().await?;
    Ok(result.exists)
}

pub async fn compute_player_summary(
    pool: &ProxyPool,
    puuid: &str,
) -> Result<(i32, i32, i32, f32, f32, i32, serde_json::Value)> {
    let url = format!("{}/db/summaries/{}", proxy_base_url(), puuid);
    
    let response = pool.client.get(&url).send().await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    #[derive(Deserialize)]
    struct SummaryResponse {
        games: i32,
        wins: i32,
        losses: i32,
        kda: f32,
        winrate: f32,
        streak: i32,
        top_champs: serde_json::Value,
    }
    
    let result: SummaryResponse = response.json().await?;
    Ok((
        result.games,
        result.wins,
        result.losses,
        result.kda,
        result.winrate,
        result.streak,
        result.top_champs,
    ))
}

pub async fn get_daily_activity(
    pool: &ProxyPool,
    puuid: &str,
) -> Result<Vec<crate::models::DailyActivityEntry>> {
    let url = format!("{}/db/activity/{}", proxy_base_url(), puuid);
    
    let response = pool.client.get(&url).send().await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    let activities: Vec<crate::models::DailyActivityEntry> = response.json().await?;
    Ok(activities)
}

pub async fn compute_rank_progress_and_cache(
    pool: &ProxyPool,
    puuid: &str,
    current_tier: &str,
    current_division: &str,
    current_lp: i32,
) -> Result<Vec<RankStep>> {
    let url = format!(
        "{}/db/rank-progress/{}?currentTier={}&currentDivision={}&currentLp={}",
        proxy_base_url(), puuid, current_tier, current_division, current_lp
    );
    
    let response = pool.client.get(&url).send().await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(anyhow!("Database proxy error: {}", error_text));
    }
    
    let steps: Vec<RankStep> = response.json().await?;
    Ok(steps)
}

impl ProxyPool {
    pub async fn begin(&self) -> Result<ProxyTx> {
        Ok(ProxyTx {
            client: self.client.clone(),
        })
    }
}

impl ProxyTx {
    pub async fn commit(self) -> Result<()> {
        Ok(())
    }
}

pub async fn summarize_match_from_db(
    pool: &ProxyPool,
    match_id: &str,
    puuid: &str,
    ddragon_version: &str,
) -> Result<crate::match_summary::MatchSummary> {
    let url = format!(
        "{}/db/match-summary/{}/{}/{}",
        proxy_base_url(), match_id, puuid, ddragon_version
    );
    eprintln!("[DB_PROXY] ➡️  GET {} (match: {}, puuid: {})", url, match_id, puuid);
    
    let response = pool.client.get(&url).send().await?;
    eprintln!("[DB_PROXY] ⬅️  GET {} -> HTTP {}", url, response.status());
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        eprintln!("[DB_PROXY] ❌ Error response for match {}: {}", match_id, error_text);
        return Err(anyhow!("Database proxy error for match {}: {}", match_id, error_text));
    }
    
    let text = response.text().await?;
    eprintln!("[DB_PROXY] 📄 Raw JSON response for match {}: {}", match_id, 
              text.chars().take(300).collect::<String>());
    
    let match_summary: crate::match_summary::MatchSummary = serde_json::from_str(&text)
        .map_err(|e| {
            eprintln!("[DB_PROXY] ❌ JSON parsing failed for match {}. Error: {}", match_id, e);
            eprintln!("[DB_PROXY] Full response: {}", text);
            anyhow!("Failed to parse match summary JSON for {}: {} - Response was: {}", match_id, e, text)
        })?;
    
    eprintln!("[DB_PROXY] ✅ Successfully parsed match summary for {}: {} {} ({})", 
              match_id, match_summary.champion_name, 
              if match_summary.win { "WIN" } else { "LOSS" }, match_summary.kda);
    
    Ok(match_summary)
}

pub async fn get_match_details_from_db(
    pool: &ProxyPool,
    match_id: &str,
    user_puuid: &str,
    ddragon_version: &str,
    _client: &reqwest::Client,
    _api_key: &str,
    _regional: &str,
) -> Result<crate::models::MatchDetails> {
    let url = format!(
        "{}/db/match-details/{}/{}/{}",
        proxy_base_url(), match_id, user_puuid, ddragon_version
    );
    
    eprintln!("[DB_PROXY] ➡️  GET {} (full match details)", url);
    
    let response = pool.client.get(&url).send().await?;
    eprintln!("[DB_PROXY] ⬅️  GET {} -> HTTP {}", url, response.status());
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        eprintln!("[DB_PROXY] ❌ Error response for match details {}: {}", match_id, error_text);
        return Err(anyhow!("Database proxy error for match details {}: {}", match_id, error_text));
    }
    
    let text = response.text().await?;
    eprintln!("[DB_PROXY] 📄 Raw JSON response for match details {}: {}", match_id, 
              text.chars().take(300).collect::<String>());
    
    let match_details: crate::models::MatchDetails = serde_json::from_str(&text)
        .map_err(|e| {
            eprintln!("[DB_PROXY] ❌ JSON parsing failed for match details {}. Error: {}", match_id, e);
            eprintln!("[DB_PROXY] Full response: {}", text);
            anyhow!("Failed to parse match details JSON for {}: {} - Response was: {}", match_id, e, text)
        })?;
    
    eprintln!("[DB_PROXY] ✅ Successfully parsed match details for {}: {} participants", 
              match_id, match_details.participants.len());
    
    Ok(match_details)
}

pub type PgPool = ProxyPool;
pub type PgTx<'a> = ProxyTx;
