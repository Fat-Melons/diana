use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::json;

use crate::{
    db_proxy as db,
    db_proxy::{PgPool, PgTx},
    models::{
        AccountDto, MatchDto, PlayerOverview, PlayerProfile, PlayerStats, SummonerDto, TopChamp,
        RankStep,
    },
    riot,
};

pub async fn sync_player_and_get_overview(
    pool: &PgPool,
    query_region: &str,
    name: &str,
    tag: &str,
    api_key: &str,
) -> Result<PlayerOverview> {
    eprintln!("[SYNC] Starting sync for player: {}#{} in region {}", name, tag, query_region);
    let (platform, regional) =
        riot::map_region(query_region).ok_or_else(|| anyhow!("Unsupported region: {}", query_region))?;

    let client = Client::builder().user_agent("Diana/0.1.0").build()?;

    let acct: AccountDto =
        riot::get_account_by_riot_id(&client, regional, name, tag).await?;
    let sum: SummonerDto =
        riot::get_summoner_by_puuid(&client, platform, &acct.puuid).await?;
    let (tier, division, lp) =
        riot::get_rank_solo(&client, platform, &acct.puuid).await?;

    db::upsert_summoner(
        pool,
        &acct.puuid,
        if sum.name.is_empty() { &acct.gameName } else { &sum.name },
        &acct.tagLine,
        &query_region.to_uppercase(),
        tier.as_deref(),
        division.as_deref(),
        lp,
    )
    .await?;

    let latest_in_db = db::latest_match_for_puuid(pool, &acct.puuid).await?;
    let latest_from_riot = riot::get_match_ids(&client, regional, &acct.puuid, 0, 1)
        .await?
        .get(0)
        .cloned();

    if let Some(latest_riot) = latest_from_riot {
        if Some(&latest_riot) != latest_in_db.as_ref() {
            let mut start = 0u32;
            let batch = 20u32;
            let max_to_fetch = if latest_in_db.is_none() { 10u32 } else { 50u32 };
            let mut fetched = 0u32;

            'outer: loop {
                let ids =
                    riot::get_match_ids(&client, regional, &acct.puuid, start, batch)
                        .await?;
                if ids.is_empty() {
                    break;
                }

                for mid in ids {
                    if Some(&mid) == latest_in_db.as_ref() {
                        break 'outer;
                    }
                    let skip_timeline = latest_in_db.is_none();
                    insert_match_with_options(&client, pool, regional, &acct.puuid, &mid, skip_timeline).await?;
                    fetched += 1;
                    if fetched >= max_to_fetch {
                        break 'outer;
                    }
                }

                start += batch;
            }
        }
    }

    let ddragon_version = riot::get_latest_ddragon_version(&client).await?;
    eprintln!("[SYNC] DDragon version: {}", ddragon_version);
    
    let recent_matches = db::get_recent_matches(pool, &acct.puuid, 10).await?;
    eprintln!("[SYNC] Found {} recent matches in database for puuid: {}", recent_matches.len(), &acct.puuid);
    
    if recent_matches.is_empty() {
        eprintln!("[SYNC] ⚠️  No matches found in database! This is unexpected after sync.");
    } else {
        eprintln!("[SYNC] Recent match IDs: {:?}", recent_matches.iter().map(|m| &m.matchId).collect::<Vec<_>>());
    }

    let mut matches = Vec::with_capacity(recent_matches.len());
    let mut successful_summaries = 0;
    let mut failed_summaries = 0;
    
    for (idx, row) in recent_matches.iter().enumerate() {
        eprintln!("[SYNC] Processing match {}/{}: {}", idx + 1, recent_matches.len(), row.matchId);
        
        match crate::db_proxy::summarize_match_from_db(
            pool,
            &row.matchId,
            &acct.puuid,
            &ddragon_version,
        ).await {
            Ok(ms) => {
                eprintln!("[SYNC] ✅ Successfully summarized match {}: {} vs {} ({})", 
                         row.matchId, ms.champion_name, 
                         if ms.win { "WIN" } else { "LOSS" }, ms.kda);
                matches.push(ms);
                successful_summaries += 1;
            }
            Err(e) => {
                eprintln!("[SYNC] ❌ Failed to summarize match {}: {}", row.matchId, e);
                failed_summaries += 1;
            }
        }
    }
    
    eprintln!("[SYNC] Match summarization complete: {} successful, {} failed, {} total matches to return", 
              successful_summaries, failed_summaries, matches.len());

    let profile_icon_url = format!(
        "https://ddragon.leagueoflegends.com/cdn/{}/img/profileicon/{}.png",
        ddragon_version, sum.profileIconId
    );

    let profile = PlayerProfile {
        puuid: acct.puuid.clone(),
        name: if sum.name.is_empty() { acct.gameName.clone() } else { sum.name.clone() },
        tagline: acct.tagLine.clone(),
        region: query_region.to_uppercase(),
        summoner_level: sum.summonerLevel as u32,
        profile_icon_url,
        tier: tier.clone(),
        division: division.clone(),
        lp,
    };

    let (games, _wins, _losses, avg_kda, winrate, streak, top_champs_json) =
        crate::db_proxy::compute_player_summary(pool, &acct.puuid).await?;
    let top_champs: Vec<TopChamp> =
        serde_json::from_value(top_champs_json).unwrap_or_else(|_| vec![]);

    let stats = PlayerStats {
        winrate,
        games,
        streak,
        kda: avg_kda,
    };

    let ranked_progress: Vec<RankStep> = if let (Some(ref t), Some(ref d), Some(lp_val)) =
        (profile.tier.as_ref(), profile.division.as_ref(), profile.lp)
    {
        crate::db_proxy::compute_rank_progress_and_cache(pool, &acct.puuid, t, d, lp_val)
            .await
            .unwrap_or_default()
    } else {
        vec![]
    };

    Ok(PlayerOverview {
        profile,
        matches,
        stats,
        top_champs,
        ranked_progress,
    })
}

async fn insert_match_with_options(
    client: &Client,
    pool: &PgPool,
    regional: &str,
    entry_puuid: &str,
    match_id: &str,
    skip_timeline: bool,
) -> Result<()> {
    if db::match_exists(pool, match_id).await? {
        println!("[DB] Match {} already exists, skipping insert.", match_id);
        return Ok(());
    }

    let m: MatchDto = crate::riot::get_match_by_id(client, regional, match_id).await?;
    
    let timeline = if skip_timeline {
        println!("[SYNC] Skipping timeline for match {} to speed up initial sync", match_id);
        serde_json::Value::Null
    } else {
        crate::riot::get_timeline_by_id(client, regional, match_id).await?
    };

    let participants_json = serde_json::to_value(&m.info.participants)?;
    let teams_json = json!({ "queueId": m.info.queueId });

    let mut tx: PgTx<'_> = pool.begin().await?;

    let mid = db::insert_match_details_tx(
        &mut tx,
        match_id,
        entry_puuid,
        None,
        Some(m.info.gameCreation),
        None,
        None,
        Some(m.info.gameDuration as i32),
        None,
        None,
        Some(m.info.queueId),
        None,
        &participants_json,
        &teams_json,
    )
    .await?;

    // Only process timeline if not skipped
    if !skip_timeline {
        if let Some(frames) = timeline
            .get("info")
            .and_then(|i| i.get("frames"))
            .and_then(|f| f.as_array())
        {
            for (idx, frame) in frames.iter().enumerate() {
                if db::timeline_frame_exists_tx(&mut tx, mid, idx as i32).await? {
                    println!(
                        "[DB] Timeline frame {} for match {} exists, skipping.",
                        idx, match_id
                    );
                    continue;
                }

                let ts = frame.get("timestamp").and_then(|t| t.as_i64());
                let participant_frames =
                    frame.get("participantFrames").cloned().unwrap_or_else(|| json!({}));
                let events = frame.get("events").cloned().unwrap_or_else(|| json!([]));

                db::insert_timeline_frame_tx(
                    &mut tx,
                    mid,
                    entry_puuid,
                    Some(idx as i32),
                    ts,
                    &participant_frames,
                    &events,
                )
                .await?;
            }
        }
    }

    tx.commit().await?;
    Ok(())
}

async fn insert_full_match(
    client: &Client,
    pool: &PgPool,
    api_key: &str,
    regional: &str,
    entry_puuid: &str,
    match_id: &str,
) -> Result<()> {
    insert_match_with_options(client, pool, regional, entry_puuid, match_id, false).await
}
