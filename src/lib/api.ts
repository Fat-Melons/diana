import { invoke } from "@tauri-apps/api/core";
import type { PlayerOverview } from "../types/riot";

export async function fetchOverview(
  name: string,
  region: string,
  tag: string,
): Promise<PlayerOverview> {
  return invoke<PlayerOverview>("get_player_overview", {
    query: { name, region, tag },
  });
}
