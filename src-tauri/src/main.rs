#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::env;

// --- Reusable request helper with full logging ---
async fn get_with_riot_token<T: for<'de> serde::Deserialize<'de>>(
    client: &reqwest::Client,
    url: &str,
    key: &str,
) -> Result<T> {
    println!("[RiotAPI] GET {url}");

    let res = client.get(url).header("X-Riot-Token", key).send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        println!(
            "[RiotAPI] ERROR {} for {} → body: {}",
            status.as_u16(),
            url,
            text
        );
        return Err(anyhow!("Riot API {}: {}", status, text));
    }

    println!("[RiotAPI] RESPONSE {} → {}", url, text);

    let json = serde_json::from_str::<T>(&text)
        .map_err(|e| anyhow!("Failed to decode JSON: {} → {}", e, text))?;
    Ok(json)
}

// --- Types ---
#[derive(Deserialize, Debug)]
struct PlayerQuery {
    name: String,
    tag: String, // Riot ID now requires tag
    region: String,
}

#[derive(Serialize, Debug)]
struct PlayerProfile {
    name: String,
    tagline: String,
    region: String,
    summoner_level: u32,
    profile_icon_url: String,
    tier: Option<String>,
    division: Option<String>,
    lp: Option<i32>,
}

#[derive(Serialize, Debug)]
struct MatchSummary {
    match_id: String,
    queue_id: i32,
    game_creation_ms: i64,
    game_duration_s: i64,
    win: bool,
    champion_name: String,
    champion_icon_url: String,
    kills: i32,
    deaths: i32,
    assists: i32,
    cs: i32,
    kda: f32,
}

#[derive(Serialize, Debug)]
struct PlayerOverview {
    profile: PlayerProfile,
    matches: Vec<MatchSummary>,
}

// --- Command ---
#[tauri::command]
async fn get_player_overview(query: PlayerQuery) -> Result<PlayerOverview, String> {
    dotenvy::dotenv().ok();
    let api_key = env::var("RIOT_API_KEY").map_err(|_| "RIOT_API_KEY not set")?;

    let (platform, regional) = map_region(&query.region)
        .ok_or_else(|| format!("Unsupported region: {}", query.region))?;

    let client = reqwest::Client::builder()
        .user_agent("Diana/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;

    // Step 1: Riot ID -> PUUID
    let acct: AccountDto =
        get_account_by_riot_id(&client, &api_key, &regional, &query.name, &query.tag)
            .await
            .map_err(|e| e.to_string())?;

    // Step 2: Summoner info
    let sum: SummonerDto =
        get_summoner_by_puuid(&client, &api_key, &platform, &acct.puuid)
            .await
            .map_err(|e| e.to_string())?;

    // Step 3: Rank (new endpoint: by-puuid)
    let (tier, division, lp) =
        get_rank_solo(&client, &api_key, &platform, &acct.puuid)
            .await
            .map_err(|e| e.to_string())?;

    // Step 4: Profile icon
    let ddragon_version = get_latest_ddragon_version(&client)
        .await
        .map_err(|e| e.to_string())?;
    let profile_icon_url = format!(
        "https://ddragon.leagueoflegends.com/cdn/{}/img/profileicon/{}.png",
        ddragon_version, sum.profileIconId
    );

    // Step 5: Matches
    let match_ids =
        get_match_ids(&client, &api_key, &regional, &acct.puuid, 0, 10)
            .await
            .map_err(|e| e.to_string())?;

    let mut matches = Vec::with_capacity(match_ids.len());
    for mid in match_ids {
        if let Ok(ms) =
            summarize_match(&client, &api_key, &regional, &mid, &acct.puuid, &ddragon_version).await
        {
            matches.push(ms);
        }
    }

    let profile = PlayerProfile {
        name: if sum.name.is_empty() { acct.gameName.clone() } else { sum.name.clone() },
        tagline: acct.tagLine.clone(),
        region: query.region.to_uppercase(),
        summoner_level: sum.summonerLevel as u32,
        profile_icon_url,
        tier,
        division,
        lp,
    };

    Ok(PlayerOverview { profile, matches })
}

// --- Region mapping ---
fn map_region(region: &str) -> Option<(&'static str, &'static str)> {
    match region.to_ascii_uppercase().as_str() {
        "EUW" | "EUW1" => Some(("euw1", "europe")),
        "EUNE" | "EUN1" => Some(("eun1", "europe")),
        "NA" | "NA1" => Some(("na1", "americas")),
        "KR" => Some(("kr", "asia")),
        "JP" | "JP1" => Some(("jp1", "asia")),
        "BR" | "BR1" => Some(("br1", "americas")),
        "LAN" | "LA1" => Some(("la1", "americas")),
        "LAS" | "LA2" => Some(("la2", "americas")),
        "OCE" | "OC1" => Some(("oc1", "sea")),
        "TR" | "TR1" => Some(("tr1", "europe")),
        "RU" | "RU1" => Some(("ru", "europe")),
        _ => None,
    }
}

// --- API helpers ---
async fn get_account_by_riot_id(
    client: &reqwest::Client,
    key: &str,
    regional: &str,
    name: &str,
    tag: &str,
) -> Result<AccountDto> {
    let url = format!(
        "https://{}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{}/{}",
        regional,
        urlencoding::encode(name),
        urlencoding::encode(tag)
    );
    get_with_riot_token(client, &url, key).await
}

async fn get_summoner_by_puuid(
    client: &reqwest::Client,
    key: &str,
    platform: &str,
    puuid: &str,
) -> Result<SummonerDto> {
    let url = format!(
        "https://{}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{}",
        platform, puuid
    );
    get_with_riot_token(client, &url, key).await
}

async fn get_rank_solo(
    client: &reqwest::Client,
    key: &str,
    platform: &str,
    puuid: &str,
) -> Result<(Option<String>, Option<String>, Option<i32>)> {
    let url = format!(
        "https://{}.api.riotgames.com/lol/league/v4/entries/by-puuid/{}",
        platform, puuid
    );
    let entries: Vec<LeagueEntryDto> = get_with_riot_token(client, &url, key).await?;
    if let Some(solo) = entries.into_iter().find(|e| e.queueType == "RANKED_SOLO_5x5") {
        Ok((Some(solo.tier), Some(solo.rank), Some(solo.leaguePoints)))
    } else {
        Ok((None, None, None))
    }
}

async fn get_match_ids(
    client: &reqwest::Client,
    key: &str,
    regional: &str,
    puuid: &str,
    start: u32,
    count: u32,
) -> Result<Vec<String>> {
    let url = format!(
        "https://{}.api.riotgames.com/lol/match/v5/matches/by-puuid/{}/ids?start={}&count={}",
        regional, puuid, start, count
    );
    get_with_riot_token(client, &url, key).await
}

async fn summarize_match(
    client: &reqwest::Client,
    key: &str,
    regional: &str,
    match_id: &str,
    puuid: &str,
    ddragon_version: &str,
) -> Result<MatchSummary> {
    let url = format!(
        "https://{}.api.riotgames.com/lol/match/v5/matches/{}",
        regional, match_id
    );
    let m: MatchDto = get_with_riot_token(client, &url, key).await?;
    let p = m
        .info
        .participants
        .into_iter()
        .find(|p| p.puuid == puuid)
        .ok_or_else(|| anyhow!("Participant not found"))?;
    let cs = p.totalMinionsKilled.unwrap_or(0) + p.neutralMinionsKilled.unwrap_or(0);
    let kda = if p.deaths == 0 {
        (p.kills + p.assists) as f32
    } else {
        (p.kills + p.assists) as f32 / p.deaths as f32
    };
    let champ_icon = format!(
        "https://ddragon.leagueoflegends.com/cdn/{}/img/champion/{}.png",
        ddragon_version, p.championName
    );
    Ok(MatchSummary {
        match_id: match_id.to_string(),
        queue_id: m.info.queueId,
        game_creation_ms: m.info.gameCreation,
        game_duration_s: m.info.gameDuration,
        win: p.win,
        champion_name: p.championName,
        champion_icon_url: champ_icon,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        cs,
        kda: (kda * 100.0).round() / 100.0,
    })
}

async fn get_latest_ddragon_version(client: &reqwest::Client) -> Result<String> {
    let url = "https://ddragon.leagueoflegends.com/api/versions.json";
    let versions: Vec<String> = get_with_riot_token(client, url, "").await?;
    versions.into_iter().next().ok_or_else(|| anyhow!("No versions"))
}

// --- DTOs ---
#[derive(Deserialize, Debug)]
struct AccountDto {
    puuid: String,
    gameName: String,
    tagLine: String,
}

#[derive(Deserialize, Debug)]
struct SummonerDto {
    #[serde(default)]
    id: String,
    puuid: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    profileIconId: i32,
    #[serde(default)]
    summonerLevel: i64,
}

#[derive(Deserialize, Debug)]
struct LeagueEntryDto {
    queueType: String,
    tier: String,
    rank: String,
    leaguePoints: i32,
}

#[derive(Deserialize, Debug)]
struct MatchDto {
    info: MatchInfo,
}
#[derive(Deserialize, Debug)]
struct MatchInfo {
    gameCreation: i64,
    gameDuration: i64,
    queueId: i32,
    participants: Vec<ParticipantDto>,
}
#[derive(Deserialize, Debug)]
struct ParticipantDto {
    puuid: String,
    championName: String,
    kills: i32,
    deaths: i32,
    assists: i32,
    win: bool,
    #[serde(default)]
    totalMinionsKilled: Option<i32>,
    #[serde(default)]
    neutralMinionsKilled: Option<i32>,
}

// --- Entry point ---
pub fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_player_overview])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
