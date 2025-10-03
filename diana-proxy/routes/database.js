const express = require("express");
const axios = require("axios");
const {
  queryOne,
  queryMany,
  queryScalar,
  transaction,
} = require("../utils/database");

const router = express.Router();

/**
 * Middleware to handle async route errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /db/summoners - debug route (should not be called)
router.get(
  "/summoners",
  asyncHandler(async (req, res) => {
    console.log("[Database] WARNING: GET /summoners called without PUUID");
    res.status(400).json({
      error: "PUUID parameter is required",
      statusCode: 400,
      hint: "Use /summoners/:puuid instead",
    });
  }),
);

// GET /db/summoners/:puuid - get_summoner
router.get(
  "/summoners/:puuid",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;

    const summoner = await queryOne(
      `
    SELECT puuid, "gameName", "tagLine", region, "matchRegionPrefix",
           "deepLolLink", tier, rank, lp, "currentMatchId", "discordChannelId",
           "regionGroup", "lastUpdated", "lastMissingDataNotification"
    FROM public.summoners
    WHERE puuid = $1
  `,
      [puuid],
    );

    // Convert numeric fields to proper types and handle null values
    if (summoner) {
      summoner.lp =
        typeof summoner.lp === "string"
          ? parseInt(summoner.lp, 10)
          : summoner.lp || 0;
      // Ensure tier is never null - Rust expects a String, not Option<String>
      summoner.tier = summoner.tier || "UNRANKED";
      // Ensure timestamp fields are properly formatted
      if (summoner.lastUpdated) {
        summoner.lastUpdated = new Date(summoner.lastUpdated).toISOString();
      }
      if (summoner.lastMissingDataNotification) {
        summoner.lastMissingDataNotification = new Date(
          summoner.lastMissingDataNotification,
        ).toISOString();
      }
    }

    console.log(
      `[Database] GET /summoners/${puuid} response:`,
      JSON.stringify(summoner),
    );
    res.json(summoner);
  }),
);

// PUT /db/summoners - upsert_summoner
router.put(
  "/summoners",
  asyncHandler(async (req, res) => {
    const { puuid, gameName, tagLine, region, tier, rank, lp } = req.body;

    if (!puuid || !gameName || !tagLine || !region) {
      return res.status(400).json({
        error: "Missing required fields: puuid, gameName, tagLine, region",
        statusCode: 400,
      });
    }

    await queryOne(
      `
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
  `,
      [puuid, gameName, tagLine, region, tier, rank, lp],
    );

    res.json({ success: true });
  }),
);

// GET /db/matches/:matchId/exists - match_exists
router.get(
  "/matches/:matchId/exists",
  asyncHandler(async (req, res) => {
    const { matchId } = req.params;

    const exists = await queryScalar(
      `
    SELECT EXISTS(SELECT 1 FROM public.match_details WHERE "matchId" = $1)
  `,
      [matchId],
    );

    res.json({ exists });
  }),
);

// GET /db/matches/:puuid/latest - latest_match_for_puuid
router.get(
  "/matches/:puuid/latest",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;

    const match = await queryOne(
      `
    SELECT mid, "matchId", "entryPlayerPuuid", "gameCreation"
    FROM public.match_details
    WHERE "entryPlayerPuuid" = $1
    ORDER BY "gameCreation" DESC
    LIMIT 1
  `,
      [puuid],
    );

    // Convert numeric fields to proper types
    if (match) {
      match.mid =
        typeof match.mid === "string" ? parseInt(match.mid, 10) : match.mid;
      match.gameCreation =
        typeof match.gameCreation === "string"
          ? parseInt(match.gameCreation, 10)
          : match.gameCreation;
    }

    res.json(match);
  }),
);

// GET /db/matches/:puuid/recent - get_recent_matches
router.get(
  "/matches/:puuid/recent",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;
    const { limit = 10 } = req.query;

    console.log(`[Database] ➡️  GET /matches/${puuid}/recent?limit=${limit}`);

    const matches = await queryMany(
      `
    SELECT mid, "matchId", "entryPlayerPuuid", "gameCreation"
    FROM public.match_details
    WHERE "entryPlayerPuuid" = $1
    ORDER BY "gameCreation" DESC
    LIMIT $2
  `,
      [puuid, parseInt(limit, 10)],
    );

    console.log(
      `[Database] 📄 Raw query result: found ${matches.length} matches`,
    );
    if (matches.length === 0) {
      console.log(`[Database] ⚠️  No matches found for puuid: ${puuid}`);
      console.log(`[Database] This could indicate:`);
      console.log(`[Database]   1. User has no matches in database`);
      console.log(`[Database]   2. PUUID mismatch`);
      console.log(`[Database]   3. Database connection issues`);
    } else {
      console.log(`[Database] First match raw:`, matches[0]);
    }

    // Convert numeric fields to proper types
    matches.forEach((match) => {
      match.mid =
        typeof match.mid === "string" ? parseInt(match.mid, 10) : match.mid;
      match.gameCreation =
        typeof match.gameCreation === "string"
          ? parseInt(match.gameCreation, 10)
          : match.gameCreation;
    });

    console.log(
      `[Database] ⬅️  GET /matches/${puuid}/recent response: ${matches.length} matches`,
    );
    if (matches.length > 0) {
      console.log(`[Database] First processed match:`, matches[0]);
      console.log(
        `[Database] Match IDs: [${matches.map((m) => m.matchId).join(", ")}]`,
      );
    }

    res.json(matches);
  }),
);

// POST /db/matches - insert_match_details_tx (with transaction support)
router.post(
  "/matches",
  asyncHandler(async (req, res) => {
    const {
      matchId,
      entryPuuid,
      gameVersion,
      gameCreation,
      gameStart,
      gameEnd,
      gameDuration,
      gameMode,
      gameType,
      queueType,
      mapName,
      participants,
      teams,
      timelineFrames, // Optional array of timeline frames to insert in same transaction
    } = req.body;

    if (!matchId || !entryPuuid || !participants || !teams) {
      return res.status(400).json({
        error:
          "Missing required fields: matchId, entryPuuid, participants, teams",
        statusCode: 400,
      });
    }

    const result = await transaction(async (client) => {
      // Insert match details - ensure JSON data is properly serialized
      const participantsJson =
        typeof participants === "string"
          ? participants
          : JSON.stringify(participants);
      const teamsJson =
        typeof teams === "string" ? teams : JSON.stringify(teams);

      const matchResult = await client.query(
        `
      INSERT INTO public.match_details
      ("matchId", "entryPlayerPuuid", "gameVersion", "gameCreation",
       "gameStartTime", "gameEndTime", "gameDuration", "gameMode",
       "gameType", "queueType", "mapName", participants, teams)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT ("matchId") DO UPDATE SET
        "entryPlayerPuuid" = EXCLUDED."entryPlayerPuuid"
      RETURNING mid
    `,
        [
          matchId,
          entryPuuid,
          gameVersion,
          gameCreation,
          gameStart,
          gameEnd,
          gameDuration,
          gameMode,
          gameType,
          queueType,
          mapName,
          participantsJson,
          teamsJson,
        ],
      );

      const mid = matchResult.rows[0]?.mid;

      if (!mid) {
        throw new Error(
          `Failed to get match ID for ${matchId}. Match insertion may have failed.`,
        );
      }

      console.log(
        `[Database] Match ${matchId} inserted/updated with mid: ${mid}`,
      );

      // Insert timeline frames if provided
      if (timelineFrames && Array.isArray(timelineFrames) && mid) {
        for (const frame of timelineFrames) {
          const {
            entryParticipantId,
            frameIndex,
            timestamp,
            participantFrames,
            events,
          } = frame;

          // Ensure JSON data is properly serialized
          const participantFramesJson =
            typeof participantFrames === "string"
              ? participantFrames
              : JSON.stringify(participantFrames);
          const eventsJson =
            typeof events === "string" ? events : JSON.stringify(events);

          await client.query(
            `
          INSERT INTO public.match_timeline
          (mid, "entryParticipantId", "frameIndex", "timestamp",
           "participantFrames", events)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT DO NOTHING
        `,
            [
              mid,
              entryParticipantId,
              frameIndex,
              timestamp,
              participantFramesJson,
              eventsJson,
            ],
          );
        }
      }

      return { mid };
    });

    res.json(result);
  }),
);

// POST /db/timeline-frames - insert_timeline_frame_tx
router.post(
  "/timeline-frames",
  asyncHandler(async (req, res) => {
    const {
      mid,
      entryParticipantId,
      frameIndex,
      timestamp,
      participantFrames,
      events,
    } = req.body;

    console.log(
      `[Database] ➡️  POST /timeline-frames with mid: ${mid}, entryParticipantId: ${entryParticipantId}`,
    );
    console.log(`[Database] Full request body:`, req.body);

    if (!mid || !entryParticipantId) {
      console.log(
        `[Database] ❌ Missing required fields - mid: ${mid}, entryParticipantId: ${entryParticipantId}`,
      );
      return res.status(400).json({
        error: "Missing required fields: mid, entryParticipantId",
        statusCode: 400,
      });
    }

    // Ensure JSON data is properly serialized
    const participantFramesJson =
      typeof participantFrames === "string"
        ? participantFrames
        : JSON.stringify(participantFrames);
    const eventsJson =
      typeof events === "string" ? events : JSON.stringify(events);

    const result = await queryOne(
      `
    INSERT INTO public.match_timeline
    (mid, "entryParticipantId", "frameIndex", "timestamp",
     "participantFrames", events)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT DO NOTHING
    RETURNING tid
  `,
      [
        mid,
        entryParticipantId,
        frameIndex,
        timestamp,
        participantFramesJson,
        eventsJson,
      ],
    );

    res.json(result);
  }),
);

// GET /db/timeline-frames/:mid/:frameIndex/exists - timeline_frame_exists_tx
router.get(
  "/timeline-frames/:mid/:frameIndex/exists",
  asyncHandler(async (req, res) => {
    const { mid, frameIndex } = req.params;

    const exists = await queryScalar(
      `
    SELECT EXISTS(
        SELECT 1
        FROM public.match_timeline
        WHERE mid = $1 AND "frameIndex" = $2
    )
  `,
      [parseInt(mid, 10), parseInt(frameIndex, 10)],
    );

    res.json({ exists });
  }),
);

// GET /db/summaries/:puuid - compute_player_summary
router.get(
  "/summaries/:puuid",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;

    const result = await queryOne(
      `
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
  `,
      [puuid],
    );

    if (!result) {
      return res.json({
        games: 0,
        wins: 0,
        losses: 0,
        tk: 0,
        td: 0,
        ta: 0,
        top_champs: [],
      });
    }

    const games = result.games || 0;
    const wins = result.wins || 0;
    const losses = result.losses || 0;
    const tk = result.tk || 0;
    const td = result.td || 0;
    const ta = result.ta || 0;
    const kda = td > 0 ? (tk + ta) / td : tk + ta;
    const winrate = games > 0 ? (wins / games) * 100.0 : 0.0;

    // Add icon URLs to champions
    const ddragonVersion = "14.18.1";
    const topChamps = result.top_champs || [];
    const champsWithIcons = topChamps.map((champ) => ({
      ...champ,
      icon_url: `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champ.champion_name}.png`,
    }));

    // Cache the results
    await queryOne(
      `
    INSERT INTO public.player_summary
    (puuid, queue_id, games, wins, losses, avg_kda, winrate, streak, top_champs, computed_at)
    VALUES ($1,$2,$3,$4,$5,$6::float8,$7::float8,$8,$9, now())
    ON CONFLICT (puuid) DO UPDATE
    SET queue_id=$2, games=$3, wins=$4, losses=$5,
        avg_kda=$6::float8, winrate=$7::float8, streak=$8, top_champs=$9, computed_at=now()
  `,
      [
        puuid,
        420,
        games,
        wins,
        losses,
        parseFloat(kda.toFixed(2)),
        parseFloat(winrate.toFixed(2)),
        0,
        JSON.stringify(champsWithIcons),
      ],
    );

    const summaryResponse = {
      games,
      wins,
      losses,
      kda: parseFloat((kda * 100).toFixed(0)) / 100,
      winrate: parseFloat((winrate * 100).toFixed(0)) / 100,
      streak: 0,
      top_champs: champsWithIcons,
    };

    console.log(
      `[Database] GET /summaries/${puuid} response:`,
      JSON.stringify(summaryResponse),
    );
    res.json(summaryResponse);
  }),
);

// GET /db/activity/:puuid - get_daily_activity
router.get(
  "/activity/:puuid",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;

    const activities = await queryMany(
      `
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
  `,
      [puuid],
    );

    res.json(activities);
  }),
);

// GET /db/rank-progress/:puuid - compute_rank_progress_and_cache
router.get(
  "/rank-progress/:puuid",
  asyncHandler(async (req, res) => {
    const { puuid } = req.params;
    const { currentTier, currentDivision, currentLp } = req.query;

    if (!currentTier || !currentDivision || currentLp === undefined) {
      return res.status(400).json({
        error:
          "Missing required query parameters: currentTier, currentDivision, currentLp",
        statusCode: 400,
      });
    }

    const matches = await queryMany(
      `
    SELECT m."matchId", m."gameCreation", (p->>'win')::bool as win
    FROM public.match_details m,
    LATERAL jsonb_array_elements(m.participants) as p
    WHERE p->>'puuid' = $1
      AND m."queueType" = 420
    ORDER BY m."gameCreation" DESC
    LIMIT 10
  `,
      [puuid],
    );

    const steps = [];
    let lp = parseInt(currentLp, 10);

    // Process matches in reverse order (oldest to newest)
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      const labelIndex = matches.length - i;
      const delta = match.win ? 15 : -15;
      const before = lp - delta;

      const step = {
        label_index: labelIndex,
        lp_before: before,
        lp_after: lp,
        lp_delta: delta,
        result: match.win ? "Win" : "Loss",
        tier_before: currentTier,
        division_before: currentDivision,
        tier_after: currentTier,
        division_after: currentDivision,
        exact: false,
        match_id: match.matchId,
      };

      // Cache the rank progress
      await queryOne(
        `
      INSERT INTO public.match_rank_progress
      (puuid, match_id, game_creation, lp_before, lp_after, lp_delta,
       tier_before, division_before, tier_after, division_after, exact)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false)
      ON CONFLICT (puuid, match_id) DO NOTHING
    `,
        [
          puuid,
          step.match_id,
          match.gameCreation,
          step.lp_before,
          step.lp_after,
          step.lp_delta,
          step.tier_before,
          step.division_before,
          step.tier_after,
          step.division_after,
        ],
      );

      steps.push(step);
      lp = before;
    }

    res.json(steps);
  }),
);

// GET /db/match-summary/:matchId/:puuid/:ddragonVersion - summarize_match_from_db
router.get(
  "/match-summary/:matchId/:puuid/:ddragonVersion",
  asyncHandler(async (req, res) => {
    const { matchId, puuid, ddragonVersion } = req.params;

    console.log(
      `[Database] ➡️  GET /match-summary/${matchId}/${puuid}/${ddragonVersion}`,
    );

    const row = await queryOne(
      `
    SELECT participants, "gameCreation", "gameDuration", "queueType"
    FROM public.match_details
    WHERE "matchId" = $1
  `,
      [matchId],
    );

    console.log(
      `[Database] 📄 Match details query result: ${row ? "found" : "not found"}`,
    );

    if (!row || !row.participants) {
      console.log(`[Database] ❌ No match data found for ${matchId}`);
      return res.status(404).json({
        error: `No participants JSON in DB for match ${matchId}`,
        statusCode: 404,
      });
    }

    console.log(
      `[Database] Found match ${matchId}: ${row.participants.length} participants, duration: ${row.gameDuration}s, queue: ${row.queueType}`,
    );
    console.log(
      `[Database] Raw data types - gameCreation: ${typeof row.gameCreation} (${row.gameCreation}), gameDuration: ${typeof row.gameDuration} (${row.gameDuration})`,
    );
    console.log(`[Database] Looking for participant with puuid: ${puuid}`);
    const participants = row.participants;
    console.log(`[Database] Looking for participant with puuid: ${puuid}`);

    const participant = participants.find((p) => p.puuid === puuid);

    if (!participant) {
      console.log(
        `[Database] ❌ Participant ${puuid} not found in match ${matchId}`,
      );
      console.log(
        `[Database] Available PUUIDs: [${participants.map((p) => p.puuid).join(", ")}]`,
      );
      return res.status(404).json({
        error: `Participant ${puuid} not found in match ${matchId}`,
        statusCode: 404,
      });
    }

    console.log(
      `[Database] ✅ Found participant: ${participant.championName} (${participant.kills}/${participant.deaths}/${participant.assists})`,
    );
    console.log(`[Database] Building match summary...`);

    const p = participant;
    const cs = (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
    const kda =
      p.deaths === 0 ? p.kills + p.assists : (p.kills + p.assists) / p.deaths;
    const champIcon = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${p.championName}.png`;
    const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5];
    const durationS = row.gameDuration || 0;
    const minutes = durationS / 60.0;
    const gpm = minutes > 0 ? p.goldEarned / minutes : 0;
    const csPerMin = minutes > 0 ? cs / minutes : 0;
    const visionPerMin = minutes > 0 ? p.visionScore / minutes : 0;

    const matchSummary = {
      match_id: matchId,
      queue_id: parseInt(row.queueType) || 0,
      game_creation_ms:
        typeof row.gameCreation === "string"
          ? parseInt(row.gameCreation)
          : row.gameCreation || 0,
      game_duration_s: parseInt(durationS) || 0,
      win: Boolean(p.win),
      champion_name: String(p.championName || ""),
      champion_icon_url: champIcon,
      kills: parseInt(p.kills) || 0,
      deaths: parseInt(p.deaths) || 0,
      assists: parseInt(p.assists) || 0,
      cs: parseInt(cs) || 0,
      kda: Math.round(kda * 100) / 100,
      role: String(p.teamPosition || ""),
      gold_earned: parseInt(p.goldEarned) || 0,
      gpm: Math.round(gpm * 100) / 100,
      cs_per_min: Math.round(csPerMin * 100) / 100,
      vision_per_min: Math.round(visionPerMin * 100) / 100,
      items: items.map((item) => parseInt(item) || 0),
      trinket: parseInt(p.item6) || 0,
      damage_dealt: parseInt(p.totalDamageDealtToChampions) || 0,
      damage_taken: parseInt(p.totalDamageTaken) || 0,
      vision_score: parseInt(p.visionScore) || 0,
      kill_participation: parseFloat(
        p.challenges ? p.challenges.killParticipation || 0.0 : 0.0,
      ),
      turret_takedowns: parseInt(p.turretTakedowns) || 0,
      dragon_kills: parseInt(p.dragonKills) || 0,
      baron_kills: parseInt(p.baronKills) || 0,
      win: Boolean(p.win),
      ddragon_version: ddragonVersion,
    };

    console.log(
      `[Database] ⬅️  GET /match-summary/${matchId} response: ${matchSummary.champion_name} ${matchSummary.win ? "WIN" : "LOSS"} (${matchSummary.kda} KDA)`,
    );
    res.json(matchSummary);
  }),
);

// GET /db/match-details/:matchId/:userPuuid/:ddragonVersion
router.get(
  "/match-details/:matchId/:userPuuid/:ddragonVersion",
  asyncHandler(async (req, res) => {
    const { matchId, userPuuid, ddragonVersion } = req.params;

    console.log(
      `[Database] ➡️  GET /match-details/${matchId}/${userPuuid}/${ddragonVersion}`,
    );

    const match = await queryOne(
      `
    SELECT "matchId", participants, teams, "gameCreation", "gameDuration", "queueType"
    FROM public.match_details
    WHERE "matchId" = $1
  `,
      [matchId],
    );

    if (!match || !match.participants) {
      console.log(`[Database] ❌ No match data found for ${matchId}`);
      return res.status(404).json({
        error: `Match ${matchId} not found in database`,
        statusCode: 404,
      });
    }

    console.log(
      `[Database] ✅ Found match ${matchId}: ${match.participants.length} participants`,
    );

    const participantPuuids = match.participants.map((p) => p.puuid);
    const summoners = await queryMany(
      `
    SELECT puuid, "gameName", "tagLine"
    FROM public.summoners
    WHERE puuid = ANY($1)
  `,
      [participantPuuids],
    );

    const summonerMap = new Map();
    summoners.forEach((summoner) => {
      summonerMap.set(
        summoner.puuid,
        `${summoner.gameName}#${summoner.tagLine}`,
      );
    });

    console.log(
      `[Database] Found ${summoners.length} summoner names for ${participantPuuids.length} participants`,
    );

    const existingSummoners = new Set(summoners.map((s) => s.puuid));
    const missingSummonerPuuids = participantPuuids.filter(
      (puuid) => !existingSummoners.has(puuid),
    );

    if (missingSummonerPuuids.length > 0) {
      console.log(
        `[Database] Fetching ${missingSummonerPuuids.length} missing summoners from Riot API...`,
      );

      const RIOT_API_KEY = process.env.RIOT_API_KEY;
      if (!RIOT_API_KEY) {
        console.log(
          `[Database] ⚠️  RIOT_API_KEY not configured, cannot fetch missing summoners`,
        );
      } else {
        for (const puuid of missingSummonerPuuids) {
          try {
            const accountResponse = await axios.get(
              `https://europe.api.riotgames.com/riot/account/v1/accounts/by-puuid/${puuid}`,
              {
                params: { api_key: RIOT_API_KEY },
                timeout: 5000,
              },
            );

            const accountData = accountResponse.data;

            await queryOne(
              `
            INSERT INTO public.summoners
            (puuid, "gameName", "tagLine", region, tier, rank, lp, "lastUpdated")
            VALUES ($1, $2, $3, $4, 'UNRANKED', NULL, 0, now())
            ON CONFLICT (puuid) DO UPDATE
            SET "gameName" = EXCLUDED."gameName",
                "tagLine" = EXCLUDED."tagLine",
                "lastUpdated" = now()
          `,
              [puuid, accountData.gameName, accountData.tagLine, "UNKNOWN"],
            );

            summonerMap.set(
              puuid,
              `${accountData.gameName}#${accountData.tagLine}`,
            );

            console.log(
              `[Database] ✅ Fetched and stored summoner: ${accountData.gameName}#${accountData.tagLine}`,
            );
          } catch (error) {
            if (error.response) {
              console.log(
                `[Database] ❌ Failed to fetch summoner for PUUID ${puuid}: HTTP ${error.response.status}`,
              );
            } else {
              console.log(
                `[Database] ❌ Error fetching summoner for PUUID ${puuid}:`,
                error.message,
              );
            }
          }
        }
      }
    }

    const participants = match.participants.map((p) => {
      const cs = (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
      const kda =
        p.deaths === 0 ? p.kills + p.assists : (p.kills + p.assists) / p.deaths;
      const champIcon = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${p.championName}.png`;
      const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5];
      const durationS = match.gameDuration || 0;
      const minutes = durationS / 60.0;
      const gpm = minutes > 0 ? p.goldEarned / minutes : 0;
      const csPerMin = minutes > 0 ? cs / minutes : 0;
      const visionPerMin = minutes > 0 ? p.visionScore / minutes : 0;

      const team = p.teamId === 100 ? "Blue" : "Red";

      return {
        puuid: p.puuid,
        summoner_name:
          summonerMap.get(p.puuid) ||
          p.riotIdGameName ||
          p.summonerName ||
          "Human Bot",
        champion_name: p.championName,
        champion_icon_url: champIcon,
        kills: parseInt(p.kills) || 0,
        deaths: parseInt(p.deaths) || 0,
        assists: parseInt(p.assists) || 0,
        cs: parseInt(cs) || 0,
        kda: Math.round(kda * 100) / 100,
        role: p.teamPosition || "",
        gold_earned: parseInt(p.goldEarned) || 0,
        gpm: Math.round(gpm * 100) / 100,
        cs_per_min: Math.round(csPerMin * 100) / 100,
        vision_per_min: Math.round(visionPerMin * 100) / 100,
        items: items.map((item) => parseInt(item) || 0),
        trinket: parseInt(p.item6) || 0,
        damage_dealt: parseInt(p.totalDamageDealtToChampions) || 0,
        damage_taken: parseInt(p.totalDamageTaken) || 0,
        vision_score: parseInt(p.visionScore) || 0,
        kill_participation: parseFloat(
          p.challenges ? p.challenges.killParticipation || 0.0 : 0.0,
        ),
        turret_takedowns: parseInt(p.turretTakedowns) || 0,
        dragon_kills: parseInt(p.dragonKills) || 0,
        baron_kills: parseInt(p.baronKills) || 0,
        win: Boolean(p.win),
        team: team,
      };
    });

    const matchDetails = {
      match_id: matchId,
      queue_id: parseInt(match.queueType) || 0,
      game_creation_ms:
        typeof match.gameCreation === "string"
          ? parseInt(match.gameCreation)
          : match.gameCreation || 0,
      game_duration_s: parseInt(match.gameDuration) || 0,
      participants: participants,
      user_puuid: userPuuid,
      ddragon_version: ddragonVersion,
    };

    console.log(
      `[Database] ⬅️  GET /match-details/${matchId} response: ${participants.length} participants`,
    );
    res.json(matchDetails);
  }),
);

module.exports = router;
