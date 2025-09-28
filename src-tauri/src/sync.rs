use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::json;

use crate::{
    db,
    db::{PgPool, PgTx},
    models::{AccountDto, MatchDto, PlayerOverview, PlayerProfile, SummonerDto},
    riot,
};

pub async fn sync_player_and_get_overview(
    pool: &PgPool,
    query_region: &str,
    name: &str,
    tag: &str,
    api_key: &str,
) -> Result<PlayerOverview> {
    let (platform, regional) =
        riot::map_region(query_region).ok_or_else(|| anyhow!("Unsupported region: {}", query_region))?;

    let client = Client::builder().user_agent("Diana/0.1.0").build()?;

    // ✅ Only need account + summoner once
    let acct: AccountDto = riot::get_account_by_riot_id(&client, api_key, regional, name, tag).await?;
    let sum: SummonerDto = riot::get_summoner_by_puuid(&client, api_key, platform, &acct.puuid).await?;
    let (tier, division, lp) = riot::get_rank_solo(&client, api_key, platform, &acct.puuid).await?;

    db::upsert_summoner(
        pool,
        &acct.puuid,
        if sum.name.is_empty() { &acct.gameName } else { &sum.name },
        &acct.tagLine,
        &query_region.to_uppercase(),
        tier.as_deref(),
        division.as_deref(),
        lp,
    ).await?;

    // --- Sync matches ---
    let latest_in_db = db::latest_match_for_puuid(pool, &acct.puuid).await?;
    let latest_from_riot = riot::get_match_ids(&client, api_key, regional, &acct.puuid, 0, 1)
        .await?
        .get(0)
        .cloned();

    if let Some(latest_riot) = latest_from_riot {
        if Some(&latest_riot) != latest_in_db.as_ref() {
            // Riot has newer matches, backfill until we catch up
            let mut start = 0u32;
            let batch = 20u32;
            let max_to_fetch = 200u32;
            let mut fetched = 0u32;

            'outer: loop {
                let ids = riot::get_match_ids(&client, api_key, regional, &acct.puuid, start, batch).await?;
                if ids.is_empty() { break; }

                for mid in ids {
                    if Some(&mid) == latest_in_db.as_ref() {
                        break 'outer;
                    }
                    insert_full_match(&client, pool, api_key, regional, &acct.puuid, &mid).await?;
                    fetched += 1;
                    if fetched >= max_to_fetch { break 'outer; }
                }

                start += batch;
            }
        }
    }

    // --- Overview: fetch last 10 matches from DB ---
    let ddragon_version = riot::get_latest_ddragon_version(&client).await?;
    let recent_matches = db::get_recent_matches(pool, &acct.puuid, 10).await?;

    let mut matches = Vec::with_capacity(recent_matches.len());
    for row in recent_matches {
        if let Ok(ms) = crate::match_summary::summarize_match_from_db(
            pool,
            &row.matchId,
            &acct.puuid,
            &ddragon_version
        ).await {
            matches.push(ms);
        }
    }

    let profile_icon_url = format!(
        "https://ddragon.leagueoflegends.com/cdn/{}/img/profileicon/{}.png",
        ddragon_version, sum.profileIconId
    );

    let profile = PlayerProfile {
        name: if sum.name.is_empty() { acct.gameName.clone() } else { sum.name.clone() },
        tagline: acct.tagLine.clone(),
        region: query_region.to_uppercase(),
        summoner_level: sum.summonerLevel as u32,
        profile_icon_url,
        tier,
        division,
        lp,
    };

    Ok(PlayerOverview { profile, matches })
}

async fn insert_full_match(
    client: &Client,
    pool: &PgPool,
    api_key: &str,
    regional: &str,
    entry_puuid: &str,
    match_id: &str,
) -> Result<()> {
    if db::match_exists(pool, match_id).await? {
        println!("[DB] Match {} already exists, skipping insert.", match_id);
        return Ok(());
    }

    let m: MatchDto = crate::riot::get_match_by_id(client, api_key, regional, match_id).await?;
    let timeline = crate::riot::get_timeline_by_id(client, api_key, regional, match_id).await?;

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
    ).await?;

    if let Some(frames) = timeline.get("info").and_then(|i| i.get("frames")).and_then(|f| f.as_array()) {
        for (idx, frame) in frames.iter().enumerate() {
            if db::timeline_frame_exists_tx(&mut tx, mid, idx as i32).await? {
                println!("[DB] Timeline frame {} for match {} exists, skipping.", idx, match_id);
                continue;
            }

            let ts = frame.get("timestamp").and_then(|t| t.as_i64());
            let participant_frames = frame.get("participantFrames").cloned().unwrap_or_else(|| json!({}));
            let events = frame.get("events").cloned().unwrap_or_else(|| json!([]));

            db::insert_timeline_frame_tx(
                &mut tx,
                mid,
                entry_puuid,
                Some(idx as i32),
                ts,
                &participant_frames,
                &events,
            ).await?;
        }
    }

    tx.commit().await?;
    Ok(())
}
