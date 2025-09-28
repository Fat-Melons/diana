use anyhow::{anyhow, Result};
use sqlx::{Pool, Postgres, Transaction};
use serde_json::Value;

use crate::models::{DbMatchRow, DbSummoner};

pub type PgPool = Pool<Postgres>;
pub type PgTx<'a> = Transaction<'a, Postgres>;

pub async fn init_pool() -> Result<PgPool> {
    let url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow!("DATABASE_URL not set"))?;
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await?;
    Ok(pool)
}

pub async fn upsert_summoner(
    pool: &PgPool,
    puuid: &str,
    game_name: &str,
    tag_line: &str,
    region: &str,
    tier: Option<&str>,
    rank: Option<&str>,
    lp: Option<i32>,
) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO public.summoners
        (puuid, "gameName", "tagLine", region, tier, rank, lp, "lastUpdated")
        VALUES ($1, $2, $3, $4, COALESCE($5, 'UNRANKED'), $6, COALESCE($7, 0), now())
        ON CONFLICT (puuid) DO UPDATE
        SET "gameName" = EXCLUDED."gameName",
            "tagLine" = EXCLUDED."tagLine",
            region = EXCLUDED.region,
            tier = EXCLUDED.tier,
            rank = EXCLUDED.rank,
            lp = EXCLUDED.lp,
            "lastUpdated" = now()
        "#
    )
        .bind(puuid)
        .bind(game_name)
        .bind(tag_line)
        .bind(region)
        .bind(tier)
        .bind(rank)
        .bind(lp)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_summoner(pool: &PgPool, puuid: &str) -> Result<Option<DbSummoner>> {
    let row = sqlx::query_as::<_, DbSummoner>(
        r#"
        SELECT puuid, "gameName", "tagLine", region, "matchRegionPrefix",
               "deepLolLink", tier, rank, lp, "currentMatchId", "discordChannelId",
               "regionGroup", "lastUpdated", "lastMissingDataNotification"
        FROM public.summoners
        WHERE puuid = $1
        "#
    )
        .bind(puuid)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn match_exists(pool: &PgPool, match_id: &str) -> Result<bool> {
    let rec = sqlx::query_scalar::<Postgres, bool>(
        r#"SELECT EXISTS(SELECT 1 FROM public.match_details WHERE "matchId" = $1)"#
    )
        .bind(match_id)
        .fetch_one(pool)
        .await?;
    Ok(rec)
}

pub async fn latest_match_for_puuid(pool: &PgPool, puuid: &str) -> Result<Option<String>> {
    let row = sqlx::query_as::<_, DbMatchRow>(
        r#"
        SELECT mid, "matchId", "entryPlayerPuuid", "gameCreation"
        FROM public.match_details
        WHERE "entryPlayerPuuid" = $1
        ORDER BY "gameCreation" DESC
        LIMIT 1
        "#
    )
        .bind(puuid)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|r| r.matchId))
}

/// New: get last N matches for a player, newest first
pub async fn get_recent_matches(pool: &PgPool, puuid: &str, limit: i64) -> Result<Vec<DbMatchRow>> {
    let rows = sqlx::query_as::<_, DbMatchRow>(
        r#"
        SELECT mid, "matchId", "entryPlayerPuuid", "gameCreation"
        FROM public.match_details
        WHERE "entryPlayerPuuid" = $1
        ORDER BY "gameCreation" DESC
        LIMIT $2
        "#
    )
        .bind(puuid)
        .bind(limit)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn insert_match_details_tx(
    tx: &mut PgTx<'_>,
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
    let rec = sqlx::query_scalar::<Postgres, i64>(
        r#"
        INSERT INTO public.match_details
        ("matchId", "entryPlayerPuuid", "gameVersion", "gameCreation",
         "gameStartTime", "gameEndTime", "gameDuration", "gameMode",
         "gameType", "queueType", "mapName", participants, teams)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT DO NOTHING
        RETURNING mid
        "#
    )
        .bind(match_id)
        .bind(entry_puuid)
        .bind(game_version)
        .bind(game_creation)
        .bind(game_start)
        .bind(game_end)
        .bind(game_duration)
        .bind(game_mode)
        .bind(game_type)
        .bind(queue_type)
        .bind(map_name)
        .bind(participants)
        .bind(teams)
        .fetch_one(tx.as_mut())
        .await?;
    Ok(rec)
}

pub async fn insert_timeline_frame_tx(
    tx: &mut PgTx<'_>,
    mid: i64,
    entry_participant_id: &str,
    frame_index: Option<i32>,
    timestamp: Option<i64>,
    participant_frames: &Value,
    events: &Value,
) -> Result<i64> {
    let rec = sqlx::query_scalar::<Postgres, i64>(
        r#"
        INSERT INTO public.match_timeline
        (mid, "entryParticipantId", "frameIndex", "timestamp",
         "participantFrames", events)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT DO NOTHING
        RETURNING tid
        "#
    )
        .bind(mid)
        .bind(entry_participant_id)
        .bind(frame_index)
        .bind(timestamp)
        .bind(participant_frames)
        .bind(events)
        .fetch_one(tx.as_mut())
        .await?;
    Ok(rec)
}

pub async fn timeline_frame_exists_tx(
    tx: &mut PgTx<'_>,
    mid: i64,
    frame_index: i32,
) -> Result<bool> {
    let rec = sqlx::query_scalar::<Postgres, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM public.match_timeline
            WHERE mid = $1 AND "frameIndex" = $2
        )
        "#
    )
        .bind(mid)
        .bind(frame_index)
        .fetch_one(tx.as_mut())
        .await?;
    Ok(rec)
}
