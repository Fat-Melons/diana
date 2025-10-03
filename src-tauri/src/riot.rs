use anyhow::{anyhow, Result};
use tokio::sync::OnceCell;
use reqwest::Client;
use serde::de::DeserializeOwned;

use crate::models::{AccountDto, LeagueEntryDto, MatchDto, SummonerDto};
use crate::db_proxy::{proxy_base_url, proxy_health_url};

pub async fn check_proxy_connectivity(client: &Client) -> Result<bool> {
    let health_url = proxy_health_url();
    
    match client.get(&health_url).timeout(std::time::Duration::from_secs(5)).send().await {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                println!("[ProxyAPI] Proxy server is available at {}", health_url);
                Ok(true)
            } else {
                println!("[ProxyAPI] Proxy server returned status {} at {}", status, health_url);
                Ok(false)
            }
        }
        Err(e) => {
            println!("[ProxyAPI] Failed to connect to proxy server at {}: {}", health_url, e);
            Ok(false)
        }
    }
}

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

async fn get_from_proxy<T: DeserializeOwned>(
    client: &Client,
    url: &str,
) -> Result<T> {
    println!("[ProxyAPI] GET {url}");
    let res = client.get(url).send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        println!("[ProxyAPI] ERROR {} for {} → body: {}", status.as_u16(), url, text);
        return Err(anyhow!("Proxy API {}: {}", status, text));
    }

    let json = serde_json::from_str::<T>(&text)
        .map_err(|e| anyhow!("Failed to decode JSON: {} → {}", e, text))?;
    Ok(json)
}

pub async fn get_account_by_riot_id(
    client: &Client,
    regional: &str,
    name: &str,
    tag: &str,
) -> Result<AccountDto> {
    let url = format!(
        "{}/riot/account/v1/accounts/by-riot-id/{}/{}?region={}",
        proxy_base_url(),
        urlencoding::encode(name),
        urlencoding::encode(tag),
        regional
    );
    get_from_proxy(client, &url).await
}

pub async fn get_account_by_puuid(
    client: &Client,
    regional: &str,
    puuid: &str,
) -> Result<AccountDto> {
    let url = format!(
        "{}/riot/account/v1/accounts/by-puuid/{}?region={}",
        proxy_base_url(), puuid, regional
    );
    get_from_proxy(client, &url).await
}

pub async fn get_summoner_by_puuid(
    client: &Client,
    platform: &str,
    puuid: &str,
) -> Result<SummonerDto> {
    let url = format!(
        "{}/lol/summoner/v4/summoners/by-puuid/{}?platform={}",
        proxy_base_url(), puuid, platform
    );
    get_from_proxy(client, &url).await
}

pub async fn get_rank_solo(
    client: &Client,
    platform: &str,
    puuid: &str,
) -> Result<(Option<String>, Option<String>, Option<i32>)> {
    let url = format!(
        "{}/lol/league/v4/entries/by-puuid/{}?platform={}",
        proxy_base_url(), puuid, platform
    );
    let entries: Vec<LeagueEntryDto> = get_from_proxy(client, &url).await?;
    if let Some(solo) = entries.into_iter().find(|e| e.queueType == "RANKED_SOLO_5x5") {
        Ok((Some(solo.tier), Some(solo.rank), Some(solo.leaguePoints)))
    } else {
        Ok((None, None, None))
    }
}

pub async fn get_match_ids(
    client: &Client,
    regional: &str,
    puuid: &str,
    start: u32,
    count: u32,
) -> Result<Vec<String>> {
    let url = format!(
        "{}/lol/match/v5/matches/by-puuid/{}/ids?region={}&start={}&count={}",
        proxy_base_url(), puuid, regional, start, count
    );
    get_from_proxy(client, &url).await
}

pub async fn get_match_by_id(
    client: &Client,
    regional: &str,
    match_id: &str,
) -> Result<MatchDto> {
    let url = format!(
        "{}/lol/match/v5/matches/{}?region={}",
        proxy_base_url(), match_id, regional
    );
    get_from_proxy(client, &url).await
}

pub async fn get_timeline_by_id(
    client: &Client,
    regional: &str,
    match_id: &str,
) -> Result<serde_json::Value> {
    let url = format!(
        "{}/lol/match/v5/matches/{}/timeline?region={}",
        proxy_base_url(), match_id, regional
    );
    get_from_proxy(client, &url).await
}

pub async fn get_latest_ddragon_version(client: &reqwest::Client) -> Result<String> {
    let v = DDRAGON_VERSION
        .get_or_try_init(|| async {
            let url = format!("{}/ddragon/versions", proxy_base_url());
            let versions: Vec<String> = get_from_proxy(client, &url).await?;
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
    regional: &str,
    puuids: &[String],
) -> Result<std::collections::HashMap<String, String>> {
    let url = format!(
        "{}/riot/account/v1/accounts/batch?region={}",
        proxy_base_url(), regional
    );
    
    let body = serde_json::json!({
        "puuids": puuids
    });
    
    println!("[ProxyAPI] POST {url}");
    let res = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;
    
    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        println!("[ProxyAPI] ERROR {} for {} → body: {}", status.as_u16(), url, text);
        return Err(anyhow!("Proxy API {}: {}", status, text));
    }

    let summoner_names: std::collections::HashMap<String, String> = serde_json::from_str(&text)
        .map_err(|e| anyhow!("Failed to decode JSON: {} → {}", e, text))?;
    
    Ok(summoner_names)
}
