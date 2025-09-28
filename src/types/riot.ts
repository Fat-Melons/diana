export type PlayerOverview = {
  profile: PlayerProfile;
  matches: MatchSummary[];
  stats: {
    winrate: number;
    games: number;
    streak: number;
    kda: number;
  };
  top_champs: TopChamp[];
  ranked_progress: RankStep[];
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
};

export type TopChamp = {
  champion_name: string;
  games: number;
  wins: number;
  winrate: number;
  kda: number;
  icon_url: string;
};

export type RankStep = {
  match_id: string;
  label_index: number;
  lp_before: number;
  lp_after: number;
  lp_delta: number;
  result: "Win" | "Loss" | "Remake";
  tier_before: string;
  division_before: "I" | "II" | "III" | "IV";
  tier_after: string;
  division_after: "I" | "II" | "III" | "IV";
  exact: boolean;
};
