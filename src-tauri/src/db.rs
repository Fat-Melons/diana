use anyhow::{anyhow, Result};
use sqlx::{Pool, Postgres, Transaction};
use serde_json::json;
use serde_json::Value;

use crate::models::{DbMatchRow, DbSummoner, RankStep};

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

pub async fn compute_player_summary(
    pool: &PgPool,
    puuid: &str,
) -> Result<(i32, i32, i32, f32, f32, i32, serde_json::Value)> {
    let row = sqlx::query!(
        r#"
        WITH me AS (
          SELECT
            md."matchId" AS match_id,
            md."gameCreation" AS game_creation,
            (p->>'win')::boolean AS win,
            (p->>'kills')::int  AS k,
            (p->>'deaths')::int AS d,
            (p->>'assists')::int AS a,
            (p->>'championName')::text AS champion,
            md."queueType" AS queue_id,
            md."gameDuration" AS duration_s
          FROM public.match_details md
          JOIN LATERAL jsonb_array_elements(md.participants) p ON true
          WHERE p->>'puuid' = $1
        ),
        ranked AS (
          SELECT * FROM me
          WHERE queue_id = 420 AND COALESCE(duration_s,0) >= 300
        ),
        sums AS (
          SELECT
            COUNT(*)::int AS games,
            SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS wins,
            SUM(CASE WHEN win THEN 0 ELSE 1 END)::int AS losses,
            SUM(k)::int AS tk,
            SUM(d)::int AS td,
            SUM(a)::int AS ta
          FROM ranked
        ),
        champs AS (
          SELECT
            champion,
            COUNT(*)::int AS games,
            SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS wins,
            SUM(k)::int AS tk,
            SUM(d)::int AS td,
            SUM(a)::int AS ta
          FROM ranked
          GROUP BY champion
          HAVING COUNT(*) >= 3
          ORDER BY games DESC, wins DESC
          LIMIT 10
        )
        SELECT
            sums.games,
            sums.wins,
            sums.losses,
            sums.tk, sums.td, sums.ta,
            (
                SELECT COALESCE(
                json_agg(json_build_object(
                    'champion_name', c.champion,
                    'games', c.games,
                    'wins', c.wins,
                    'winrate', CASE WHEN c.games>0
                                    THEN ((c.wins::float8/c.games::float8)*100)::int
                                    ELSE 0 END,
                    'kda', CASE WHEN c.td=0
                                THEN (c.tk+c.ta)::float8
                                ELSE ROUND(((c.tk+c.ta)::numeric/NULLIF(c.td,0)), 2)::float8
                         END
                )),
                '[]'::json
                )
                FROM champs c
            ) AS top_champs
            FROM sums;
        "#,
        puuid
    )
    .fetch_one(pool)
    .await?;

    let games = row.games.unwrap_or(0);
    let wins = row.wins.unwrap_or(0);
    let losses = row.losses.unwrap_or(0);
    let tk = row.tk.unwrap_or(0) as f32;
    let td = row.td.unwrap_or(0) as f32;
    let ta = row.ta.unwrap_or(0) as f32;
    let kda = if td > 0.0 { (tk + ta) / td } else { tk + ta };
    let winrate = if games > 0 { (wins as f32 / games as f32) * 100.0 } else { 0.0 };

    let ddragon_version = "14.18.1";
    let mut champs_with_icons = Vec::new();
    if let Some(arr) = row.top_champs.as_ref().and_then(|v| v.as_array()) {
        for c in arr {
            if let (Some(name), Some(games), Some(wins), Some(winrate), Some(kda)) = (
                c.get("champion_name").and_then(|v| v.as_str()),
                c.get("games").and_then(|v| v.as_i64()),
                c.get("wins").and_then(|v| v.as_i64()),
                c.get("winrate").and_then(|v| v.as_i64()),
                c.get("kda").and_then(|v| v.as_f64()),
            ) {
                champs_with_icons.push(json!({
                    "champion_name": name,
                    "games": games,
                    "wins": wins,
                    "winrate": winrate,
                    "kda": kda,
                    "icon_url": format!(
                        "https://ddragon.leagueoflegends.com/cdn/{}/img/champion/{}.png",
                        ddragon_version, name
                    )
                }));
            }
        }
    }
    let top_champs = serde_json::Value::Array(champs_with_icons);

    sqlx::query!(
        r#"
        INSERT INTO public.player_summary
        (puuid, queue_id, games, wins, losses, avg_kda, winrate, streak, top_champs, computed_at)
        VALUES ($1,$2,$3,$4,$5,$6::float8,$7::float8,$8,$9, now())
        ON CONFLICT (puuid) DO UPDATE
        SET queue_id=$2, games=$3, wins=$4, losses=$5,
            avg_kda=$6::float8, winrate=$7::float8, streak=$8, top_champs=$9, computed_at=now()
        "#,
        puuid,
        420,
        games,
        wins,
        losses,
        (kda as f64),
        (winrate as f64),
        0,
        top_champs
    )
    .execute(pool)
    .await?;

    Ok((
        games,
        wins,
        losses,
        (kda * 100.0).round() / 100.0,
        (winrate * 100.0).round() / 100.0,
        0,
        top_champs,
    ))
}

pub async fn get_daily_activity(
    pool: &PgPool,
    puuid: &str,
) -> Result<Vec<crate::models::DailyActivityEntry>> {
    let rows = sqlx::query!(
        r#"
        WITH daily_counts AS (
            SELECT 
                DATE(to_timestamp("gameCreation" / 1000)) as game_date,
                COUNT(*) as games
            FROM public.match_details
            WHERE "entryPlayerPuuid" = $1
                AND "gameCreation" >= extract(epoch from (now() - interval '30 days')) * 1000
                AND "queueType" = 420
            GROUP BY DATE(to_timestamp("gameCreation" / 1000))
        ),
        date_series AS (
            SELECT generate_series(
                CURRENT_DATE - interval '29 days',
                CURRENT_DATE,
                interval '1 day'
            )::date as date
        )
        SELECT 
            ds.date::text as date,
            COALESCE(dc.games, 0)::int as games
        FROM date_series ds
        LEFT JOIN daily_counts dc ON ds.date = dc.game_date
        ORDER BY ds.date
        "#,
        puuid
    )
    .fetch_all(pool)
    .await?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(crate::models::DailyActivityEntry {
            date: row.date.unwrap_or_default(),
            games: row.games.unwrap_or(0),
        });
    }

    Ok(entries)
}

pub async fn compute_rank_progress_and_cache(
    pool: &PgPool,
    puuid: &str,
    current_tier: &str,
    current_division: &str,
    current_lp: i32,
) -> Result<Vec<RankStep>> {
    let rows = sqlx::query!(
        r#"
        SELECT m."matchId", m."gameCreation", (p->>'win')::bool as win
        FROM public.match_details m,
        LATERAL jsonb_array_elements(m.participants) as p
        WHERE p->>'puuid' = $1
          AND m."queueType" = 420
        ORDER BY m."gameCreation" DESC
        LIMIT 10
        "#,
        puuid
    )
    .fetch_all(pool)
    .await?;

    let mut steps: Vec<RankStep> = Vec::new();
    let mut lp = current_lp;

    for (i, row) in rows.into_iter().rev().enumerate() {
        let delta = if row.win.unwrap_or(false) { 15 } else { -15 };
        let before = lp - delta;

        let step = RankStep {
            label_index: (i + 1) as i32,
            lp_before: before,
            lp_after: lp,
            lp_delta: delta,
            result: if row.win.unwrap_or(false) { "Win".to_string() } else { "Loss".to_string() },
            tier_before: current_tier.to_string(),
            division_before: current_division.to_string(),
            tier_after: current_tier.to_string(),
            division_after: current_division.to_string(),
            exact: false,
            match_id: row.matchId,
        };

        sqlx::query!(
            r#"
            INSERT INTO public.match_rank_progress
            (puuid, match_id, game_creation, lp_before, lp_after, lp_delta,
             tier_before, division_before, tier_after, division_after, exact)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false)
            ON CONFLICT (puuid, match_id) DO NOTHING
            "#,
            puuid,
            step.match_id,
            row.gameCreation,
            step.lp_before,
            step.lp_after,
            step.lp_delta,
            step.tier_before,
            step.division_before,
            step.tier_after,
            step.division_after
        )
        .execute(pool)
        .await?;

        steps.push(step);
        lp = before;
    }

    Ok(steps)
}
