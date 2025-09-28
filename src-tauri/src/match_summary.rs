use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::Deserialize;

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

    #[serde(default)]
    goldEarned: i32,
    #[serde(default)]
    item0: i32,
    #[serde(default)]
    item1: i32,
    #[serde(default)]
    item2: i32,
    #[serde(default)]
    item3: i32,
    #[serde(default)]
    item4: i32,
    #[serde(default)]
    item5: i32,
    #[serde(default)]
    item6: i32,
    #[serde(default)]
    totalDamageDealtToChampions: i32,
    #[serde(default)]
    totalDamageTaken: i32,
    #[serde(default)]
    visionScore: i32,
    #[serde(default)]
    teamPosition: String,
    #[serde(default)]
    challenges: Option<ChallengesDto>,
    #[serde(default)]
    turretTakedowns: i32,
    #[serde(default)]
    dragonKills: i32,
    #[serde(default)]
    baronKills: i32,
}

#[derive(Deserialize, Debug)]
struct ChallengesDto {
    #[serde(default)]
    killParticipation: f32,
}

pub async fn summarize_match(
    client: &Client,
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
    println!("[RiotAPI] GET {url}");

    let res = client.get(&url).header("X-Riot-Token", key).send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        println!("[RiotAPI] ERROR {} → {}", status, text);
        return Err(anyhow!("Riot API {}: {}", status, text));
    }

    let m: MatchDto = serde_json::from_str(&text)
        .map_err(|e| anyhow!("Failed to decode match JSON: {} → {}", e, text))?;

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

    let items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5];

    let minutes = (m.info.gameDuration as f32) / 60.0;
    let gpm = if minutes > 0.0 { p.goldEarned as f32 / minutes } else { 0.0 };
    let cs_per_min = if minutes > 0.0 { cs as f32 / minutes } else { 0.0 };
    let vision_per_min = if minutes > 0.0 { p.visionScore as f32 / minutes } else { 0.0 };

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
        role: p.teamPosition,
        gold_earned: p.goldEarned,
        gpm,
        cs_per_min,
        vision_per_min,
        items,
        trinket: p.item6,
        damage_dealt: p.totalDamageDealtToChampions,
        damage_taken: p.totalDamageTaken,
        vision_score: p.visionScore,
        kill_participation: p.challenges.map(|c| c.killParticipation).unwrap_or(0.0),
        turret_takedowns: p.turretTakedowns,
        dragon_kills: p.dragonKills,
        baron_kills: p.baronKills,
        ddragon_version: ddragon_version.to_string(),
    })
}

use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct MatchSummary {
    pub match_id: String,
    pub queue_id: i32,
    pub game_creation_ms: i64,
    pub game_duration_s: i64,
    pub win: bool,
    pub champion_name: String,
    pub champion_icon_url: String,
    pub kills: i32,
    pub deaths: i32,
    pub assists: i32,
    pub cs: i32,
    pub kda: f32,
    pub role: String,
    pub gold_earned: i32,
    pub gpm: f32,
    pub cs_per_min: f32,
    pub vision_per_min: f32, 
    pub items: [i32; 6],
    pub trinket: i32,
    pub damage_dealt: i32,
    pub damage_taken: i32,
    pub vision_score: i32,
    pub kill_participation: f32,
    pub turret_takedowns: i32,
    pub dragon_kills: i32,
    pub baron_kills: i32,
    pub ddragon_version: String,
}