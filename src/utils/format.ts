
import type { MatchSummary } from "../types/riot";

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return `just now`;
}

export function queueName(queueId: number): string {
  switch (queueId) {
    case 420:
      return "Ranked";
    case 440:
      return "Ranked Flex";
    case 400:
      return "Draft";
    case 430:
      return "Blind";
    case 450:
      return "ARAM";
    default:
      return `Queue ${queueId}`;
  }
}

export function formatKDA(k: number, d: number, a: number): string {
  return `${k}/${d}/${a}`;
}

export function rankEmblemFromTier(tier?: string | null): string | null {
  if (!tier) return null;
  const key = tier.toLowerCase();
  return `/src/assets/ranked-emblem/${key}.webp`;
}

export function getRoleNameTranslation(role: string): string {
  const roleMap = new Map<string, string>([
    ["TOP", "Top"],
    ["JUNGLE", "Jungle"],
    ["MIDDLE", "Mid"],
    ["BOTTOM", "ADC"],
    ["UTILITY", "Support"],
  ]);
  return roleMap.get(role?.toUpperCase?.() ?? "") || "Unknown";
}

export function deriveProfileStats(matches: MatchSummary[]) {
  const ranked = matches.filter((m) => (m.queueId ?? (m as any).queue_id) === 420);
  const sample = ranked.slice(0, 20);

  let wins = 0, k = 0, d = 0, a = 0, streak = 0;
  for (let i = 0; i < sample.length; i++) {
    const m = sample[i];
    const isWin = m.result === "Win";
    if (i === 0) streak = isWin ? 1 : -1;
    else streak = (streak > 0 && isWin) || (streak < 0 && !isWin) ? (isWin ? streak + 1 : streak - 1) : (isWin ? 1 : -1);
    wins += isWin ? 1 : 0;
    k += m.kills;
    d += m.deaths;
    a += m.assists;
  }

  const games = sample.length;
  const winrate = games ? Math.round((wins / games) * 100) : 0;
  const kda = d ? (k + a) / d : (k + a);

  return { winrate, games, streak, kda };
}
