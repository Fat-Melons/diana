use anyhow::{anyhow, Result};
use serde::Serialize;
use serde_json::Value;

use crate::{
    db::PgPool,
    models::{ParticipantDto, MatchDetails, MatchParticipantDetail},
    riot,
};

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

pub async fn summarize_match_from_db(
    pool: &PgPool,
    match_id: &str,
    puuid: &str,
    ddragon_version: &str,
) -> Result<MatchSummary> {
    let row = sqlx::query!(
        r#"
        SELECT participants, "gameCreation", "gameDuration", "queueType"
        FROM public.match_details
        WHERE "matchId" = $1
        "#,
        match_id
    )
    .fetch_one(pool)
    .await?;

    let participants_val: Value = row
        .participants
        .ok_or_else(|| anyhow!("No participants JSON in DB for match {}", match_id))?;

    let participants: Vec<ParticipantDto> = serde_json::from_value(participants_val)?;

    let p = participants
        .into_iter()
        .find(|p| p.puuid == puuid)
        .ok_or_else(|| anyhow!("Participant {} not found in match {}", puuid, match_id))?;

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

    let duration_s = row.gameDuration.unwrap_or(0) as i64;
    let minutes = duration_s as f32 / 60.0;

    let gpm = if minutes > 0.0 { p.goldEarned as f32 / minutes } else { 0.0 };
    let cs_per_min = if minutes > 0.0 { cs as f32 / minutes } else { 0.0 };
    let vision_per_min = if minutes > 0.0 { p.visionScore as f32 / minutes } else { 0.0 };

    Ok(MatchSummary {
        match_id: match_id.to_string(),
        queue_id: row.queueType.unwrap_or(0),
        game_creation_ms: row.gameCreation.unwrap_or(0),
        game_duration_s: duration_s,
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

pub async fn get_match_details_from_db(
    pool: &PgPool,
    match_id: &str,
    user_puuid: &str,
    ddragon_version: &str,
    client: &reqwest::Client,
    api_key: &str,
    regional: &str,
) -> Result<MatchDetails> {
    let row = sqlx::query!(
        r#"
        SELECT participants, "gameCreation", "gameDuration", "queueType"
        FROM public.match_details
        WHERE "matchId" = $1
        "#,
        match_id
    )
    .fetch_one(pool)
    .await?;

    let participants_val: serde_json::Value = row
        .participants
        .ok_or_else(|| anyhow!("No participants JSON in DB for match {}", match_id))?;

    let participants: Vec<ParticipantDto> = serde_json::from_value(participants_val)?;

    let duration_s = row.gameDuration.unwrap_or(0) as i64;
    let minutes = duration_s as f32 / 60.0;

    let puuids: Vec<String> = participants.iter().map(|p| p.puuid.clone()).collect();
    
    let summoner_names = riot::get_summoner_names_by_puuids(client, api_key, regional, &puuids)
        .await
        .unwrap_or_else(|e| {
            println!("[Match] Failed to fetch summoner names: {}", e);
            puuids.iter().enumerate().map(|(i, puuid)| {
                (puuid.clone(), format!("Player {}", i + 1))
            }).collect()
        });

    let mut match_participants = Vec::new();

    for p in participants {
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
        let gpm = if minutes > 0.0 { p.goldEarned as f32 / minutes } else { 0.0 };
        let cs_per_min = if minutes > 0.0 { cs as f32 / minutes } else { 0.0 };
        let vision_per_min = if minutes > 0.0 { p.visionScore as f32 / minutes } else { 0.0 };

        let team = if p.teamId == 100 { "Blue" } else { "Red" };

        let summoner_name = summoner_names.get(&p.puuid).cloned().unwrap_or_else(|| "Unknown".to_string());

        match_participants.push(MatchParticipantDetail {
            puuid: p.puuid.clone(),
            summoner_name,
            champion_name: p.championName.clone(),
            champion_icon_url: champ_icon,
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
            cs,
            kda: (kda * 100.0).round() / 100.0,
            role: p.teamPosition.clone(),
            gold_earned: p.goldEarned,
            gpm,
            cs_per_min,
            vision_per_min,
            items,
            trinket: p.item6,
            damage_dealt: p.totalDamageDealtToChampions,
            damage_taken: p.totalDamageTaken,
            vision_score: p.visionScore,
            kill_participation: p.challenges.as_ref().map(|c| c.killParticipation).unwrap_or(0.0),
            turret_takedowns: p.turretTakedowns,
            dragon_kills: p.dragonKills,
            baron_kills: p.baronKills,
            win: p.win,
            team: team.to_string(),
        });
    }

    match_participants.sort_by(|a, b| {
        match (a.win, b.win) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.role.cmp(&b.role),
        }
    });

    Ok(MatchDetails {
        match_id: match_id.to_string(),
        queue_id: row.queueType.unwrap_or(0),
        game_creation_ms: row.gameCreation.unwrap_or(0),
        game_duration_s: duration_s,
        participants: match_participants,
        user_puuid: user_puuid.to_string(),
        ddragon_version: ddragon_version.to_string(),
    })
}

