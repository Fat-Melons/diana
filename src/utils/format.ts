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
    case 420: return "Ranked";
    case 440: return "Ranked Flex";
    case 400: return "Draft";
    case 430: return "Blind";
    case 450: return "ARAM";
    default:  return `Queue ${queueId}`;
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
    ['TOP', 'Top'],
    ['JUNGLE', 'Jungle'],
    ['MIDDLE', 'Mid'],
    ['BOTTOM', 'ADC'],
    ['UTILITY', 'Support'],
  ]);
  return roleMap.get(role?.toUpperCase?.() ?? "") || 'Unknown';
}