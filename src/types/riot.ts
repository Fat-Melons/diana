export type PlayerOverview = {
  profile: PlayerProfile;
  matches: MatchSummary[];
};

export type PlayerProfile = {
  name: string;
  tagline?: string | null;
  region: string; // e.g., "EUW"
  summoner_level: number;
  profile_icon_url: string;
  tier?: string | null;     // e.g., "GOLD"
  division?: string | null; // e.g., "II"
  lp?: number | null;       // League Points
};

export type MatchSummary = {
  match_id: string;
  queue_id: number;         // 420, 440, 400, etc.
  game_creation_ms: number; // epoch ms
  game_duration_s: number;  // seconds
  win: boolean;

  champion_name: string;     // e.g., "Ahri"
  champion_icon_url: string; // DDragon icon URL

  kills: number;
  deaths: number;
  assists: number;
  cs: number;                // total minions + jungle
  kda: number;               // rounded to 2 decimals server-side
};
