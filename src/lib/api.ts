import { invoke } from "@tauri-apps/api/core";
import type {
  PlayerOverview,
  MatchDetails,
  DailyActivityEntry,
} from "../types/riot";

export async function fetchOverview(
  name: string,
  region: string,
  tag: string,
): Promise<PlayerOverview> {
  return invoke<PlayerOverview>("get_player_overview", {
    query: { name, region, tag },
  });
}

export async function fetchMatchDetails(
  matchId: string,
  userPuuid: string,
): Promise<MatchDetails> {
  return invoke<MatchDetails>("get_match_details", {
    query: { match_id: matchId, user_puuid: userPuuid },
  });
}

export async function fetchDailyActivity(
  userPuuid: string,
): Promise<DailyActivityEntry[]> {
  return invoke<DailyActivityEntry[]>("get_daily_activity", {
    query: { user_puuid: userPuuid },
  });
}
