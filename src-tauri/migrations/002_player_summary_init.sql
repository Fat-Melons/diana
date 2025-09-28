CREATE TABLE IF NOT EXISTS public.player_summary (
  puuid           TEXT PRIMARY KEY,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  queue_id        INTEGER NOT NULL DEFAULT 420,
  games           INTEGER NOT NULL,
  wins            INTEGER NOT NULL,
  losses          INTEGER NOT NULL,
  avg_kda         NUMERIC(6,2) NOT NULL,
  winrate         NUMERIC(5,2) NOT NULL,
  streak          INTEGER NOT NULL,
  top_champs      JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_summary_puuid ON public.player_summary(puuid);

CREATE TABLE IF NOT EXISTS public.match_rank_progress (
  puuid            TEXT NOT NULL,
  match_id         TEXT NOT NULL,
  game_creation    BIGINT NOT NULL,
  lp_before        INTEGER NOT NULL,
  lp_after         INTEGER NOT NULL,
  lp_delta         INTEGER NOT NULL,
  tier_before      TEXT NOT NULL,
  division_before  TEXT NOT NULL,
  tier_after       TEXT NOT NULL,
  division_after   TEXT NOT NULL,
  exact            BOOLEAN NOT NULL DEFAULT FALSE,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (puuid, match_id)
);

CREATE INDEX IF NOT EXISTS idx_mrp_puuid_creation ON public.match_rank_progress(puuid, game_creation DESC);