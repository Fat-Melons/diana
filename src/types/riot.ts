export type PlayerOverview = {
  profile: PlayerProfile;
  matches: MatchSummary[];
};

export type PlayerProfile = {
  name: string;
  tagline?: string | null;
  region: string;
  summoner_level: number;
  profile_icon_url: string;
  tier?: string | null;
  division?: string | null;
  lp?: number | null;
};

export type MatchSummary = {
  match_id: string;
  queue_id: number;
  game_creation_ms: number;
  game_duration_s: number;
  win: boolean;

  champion_name: string;
  champion_icon_url: string;

  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  kda: number;

  role: string;
  gold_earned: number;

  items: [number, number, number, number, number, number];
  trinket: number;

  damage_dealt: number;
  damage_taken: number;
  vision_score: number;
  kill_participation: number;
  turret_takedowns: number;
  dragon_kills: number;
  baron_kills: number;

  ddragon_version: string;

  gpm: number;
  cs_per_min: number;
  vision_per_min: number;
};
