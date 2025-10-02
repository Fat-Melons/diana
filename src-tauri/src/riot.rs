use anyhow::{anyhow, Result};
use tokio::sync::OnceCell;
use reqwest::Client;
use serde::de::DeserializeOwned;

use crate::models::{AccountDto, LeagueEntryDto, MatchDto, SummonerDto};

static DDRAGON_VERSION: OnceCell<String> = OnceCell::const_new();

pub fn map_region(region: &str) -> Option<(&'static str, &'static str)> {
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

async fn get_with_riot_token<T: DeserializeOwned>(
    client: &Client,
    url: &str,
    key: &str,
) -> Result<T> {
    println!("[RiotAPI] GET {url}");
    let res = client.get(url).header("X-Riot-Token", key).send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        println!("[RiotAPI] ERROR {} for {} → body: {}", status.as_u16(), url, text);
        return Err(anyhow!("Riot API {}: {}", status, text));
    }

    let json = serde_json::from_str::<T>(&text)
        .map_err(|e| anyhow!("Failed to decode JSON: {} → {}", e, text))?;
    Ok(json)
}

pub async fn get_account_by_riot_id(
    client: &Client,
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

pub async fn get_account_by_puuid(
    client: &Client,
    key: &str,
    regional: &str,
    puuid: &str,
) -> Result<AccountDto> {
    let url = format!(
        "https://{}.api.riotgames.com/riot/account/v1/accounts/by-puuid/{}",
        regional, puuid
    );
    get_with_riot_token(client, &url, key).await
}

pub async fn get_summoner_by_puuid(
    client: &Client,
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

pub async fn get_rank_solo(
    client: &Client,
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

pub async fn get_match_ids(
    client: &Client,
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

pub async fn get_match_by_id(
    client: &Client,
    key: &str,
    regional: &str,
    match_id: &str,
) -> Result<MatchDto> {
    let url = format!(
        "https://{}.api.riotgames.com/lol/match/v5/matches/{}",
        regional, match_id
    );
    get_with_riot_token(client, &url, key).await
}

pub async fn get_timeline_by_id(
    client: &Client,
    key: &str,
    regional: &str,
    match_id: &str,
) -> Result<serde_json::Value> {
    let url = format!(
        "https://{}.api.riotgames.com/lol/match/v5/matches/{}/timeline",
        regional, match_id
    );
    get_with_riot_token(client, &url, key).await
}

pub async fn get_latest_ddragon_version(client: &reqwest::Client) -> Result<String> {
    let v = DDRAGON_VERSION
        .get_or_try_init(|| async {
            let url = "https://ddragon.leagueoflegends.com/api/versions.json";
            let versions: Vec<String> = get_with_riot_token(client, url, "").await?;
            versions
                .into_iter()
                .next()
                .ok_or_else(|| anyhow!("No versions"))
        })
        .await?;

    Ok(v.clone())
}

pub async fn get_summoner_names_by_puuids(
    client: &Client,
    key: &str,
    regional: &str,
    puuids: &[String],
) -> Result<std::collections::HashMap<String, String>> {
    use tokio::time::{sleep, Duration};
    
    let mut summoner_names = std::collections::HashMap::new();
    
    for puuid in puuids {
        match get_account_by_puuid(client, key, regional, puuid).await {
            Ok(account) => {
                let display_name = if account.tagLine.is_empty() {
                    account.gameName.clone()
                } else {
                    format!("{}#{}", account.gameName, account.tagLine)
                };
                summoner_names.insert(puuid.clone(), display_name);
            }
            Err(e) => {
                println!("[RiotAPI] Failed to fetch account for PUUID {}: {}", puuid, e);
                let short_id = if puuid.len() >= 8 { &puuid[0..8] } else { puuid };
                summoner_names.insert(puuid.clone(), format!("Player {}", short_id));
            }
        }
        
        sleep(Duration::from_millis(100)).await;
    }
    
    Ok(summoner_names)
}
