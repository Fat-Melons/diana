let cachedItems: Record<string, any> | null = null;
let cachedVersion: string | null = null;

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

// Import all ranked emblem assets
import ironEmblem from '../assets/ranked-emblem/iron.webp';
import bronzeEmblem from '../assets/ranked-emblem/bronze.webp';
import silverEmblem from '../assets/ranked-emblem/silver.webp';
import goldEmblem from '../assets/ranked-emblem/gold.webp';
import platinumEmblem from '../assets/ranked-emblem/platinum.webp';
import emeraldEmblem from '../assets/ranked-emblem/emerald.webp';
import diamondEmblem from '../assets/ranked-emblem/diamond.webp';
import masterEmblem from '../assets/ranked-emblem/master.webp';
import grandmasterEmblem from '../assets/ranked-emblem/grandmaster.webp';
import challengerEmblem from '../assets/ranked-emblem/challenger.webp';
import unrankedEmblem from '../assets/ranked-emblem/unranked.webp';

// Create emblem mapping
const rankEmblems: Record<string, string> = {
  iron: ironEmblem,
  bronze: bronzeEmblem,
  silver: silverEmblem,
  gold: goldEmblem,
  platinum: platinumEmblem,
  emerald: emeraldEmblem,
  diamond: diamondEmblem,
  master: masterEmblem,
  grandmaster: grandmasterEmblem,
  challenger: challengerEmblem,
  unranked: unrankedEmblem,
};

export function rankEmblemFromTier(tier?: string | null): string | null {
  if (!tier) return null;
  const key = tier.toLowerCase();
  return rankEmblems[key] || null;
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

export async function getItemName(
  id: number,
  version: string,
): Promise<string> {
  try {
    if (!cachedItems || cachedVersion !== version) {
      const res = await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`,
      );
      if (!res.ok) throw new Error("Failed to fetch item data");
      const data = await res.json();
      cachedItems = data.data;
      cachedVersion = version;
    }

    const item = cachedItems?.[id];
    return item?.name ?? `Item ${id}`;
  } catch (err) {
    console.error("Error fetching item name:", err);
    return `Item ${id}`;
  }
}

export const numK = (n: number) => {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "k";
  return `${n}`;
};

export const killPartPercentage = (p: number) => `${Math.round(p * 100)}%`;

export const roleIsSupport = (role: string) =>
  role?.toUpperCase() === "UTILITY";

export const formatDurationMin = (s: number) => `${Math.round(s / 60)}m`;

export const getBaseSummonerName = (name: string) => {
  const hashIndex = name.indexOf("#");
  return hashIndex !== -1 ? name.substring(0, hashIndex) : name;
};

export const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

export const DIVISIONS = ["IV", "III", "II", "I"] as const;

export type Tier = (typeof TIERS)[number];
export type Division = (typeof DIVISIONS)[number];

export function getTierOrder(tier: string): number {
  const index = TIERS.indexOf(tier.toUpperCase() as Tier);
  return index === -1 ? 0 : index;
}

export function getDivisionOrder(division: string): number {
  const index = DIVISIONS.indexOf(division as Division);
  return index === -1 ? 0 : index;
}

export function rankToTotalLP(
  tier: string,
  division: string,
  lp: number,
): number {
  const tierOrder = getTierOrder(tier);
  const divisionOrder = getDivisionOrder(division);

  const tierLP = tierOrder * 400;
  const divisionLP = divisionOrder * 100;

  return tierLP + divisionLP + lp;
}

export function totalLPToRank(totalLP: number): {
  tier: string;
  division: string;
  lp: number;
} {
  if (totalLP < 0) totalLP = 0;

  const tierIndex = Math.floor(totalLP / 400);
  const remainingLP = totalLP % 400;
  const divisionIndex = Math.floor(remainingLP / 100);
  const lp = remainingLP % 100;

  const tier = TIERS[Math.min(tierIndex, TIERS.length - 1)];
  const division = DIVISIONS[Math.min(divisionIndex, DIVISIONS.length - 1)];

  return { tier, division, lp };
}

export function formatRank(tier: string, division: string): string {
  if (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier.toUpperCase())) {
    return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  }
  return `${tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()} ${division}`;
}
