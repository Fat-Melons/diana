import React, { useMemo } from "react";
import type { MatchSummary } from "../types/riot";

export type TopChampsProps = { matches: MatchSummary[] };

const TopChamps: React.FC<TopChampsProps> = ({ matches }) => {
  const champs = useMemo(() => computeTopChamps(matches), [matches]);
  if (champs.length === 0) return null;

  return (
    <section className="topchamps-card fancy-card">
      <div className="card-head">
        <h3 className="card-title">Top Played Champions</h3>
      </div>
      <div className="champ-list">
        {champs.map(c => (
          <div key={c.name} className="champ-row">
            <div className="champ-badge"><img src={c.iconUrl} alt={c.name} /></div>
            <div className="champ-meta">
              <div className="champ-name">{c.name}</div>
              <div className="small muted">{c.games} games • {c.winrate}% WR • KDA {c.kda.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TopChamps;

function computeTopChamps(matches: MatchSummary[]) {
  const map = new Map<string, any>();
  for (const m of matches) {
    const key = m.championName;
    if (!map.has(key)) map.set(key, { name: key, games: 0, wins: 0, k: 0, d: 0, a: 0, iconUrl: m.championIconUrl ?? "" });
    const agg = map.get(key);
    agg.games++;
    if (m.result === "Win") agg.wins++;
    agg.k += m.kills;
    agg.d += m.deaths;
    agg.a += m.assists;
  }
  return Array.from(map.values())
    .map(r => ({ ...r, winrate: Math.round((r.wins / r.games) * 100), kda: r.d ? (r.k + r.a) / r.d : (r.k + r.a) }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 3);
}
