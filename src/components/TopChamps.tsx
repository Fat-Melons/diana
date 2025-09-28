import React from "react";
import type { TopChamp } from "../types/riot";

export type TopChampsProps = {
  champs: TopChamp[];
};

const TopChamps: React.FC<TopChampsProps> = ({ champs }) => {
  if (!champs || champs.length === 0) return null;

  return (
    <section className="topchamps-card fancy-card">
      <div className="card-head">
        <h3 className="card-title">Top Played Champions (Ranked)</h3>
      </div>
      <div className="champ-list">
        {champs.slice(0, 3).map((c) => (
          <div key={c.champion_name} className="champ-row">
            <div className="champ-badge">
              <img src={c.icon_url} alt={c.champion_name} />
            </div>
            <div className="champ-meta">
              <div className="champ-name">{c.champion_name}</div>
              <div className="small muted">
                {c.games} games • {c.winrate}% WR • KDA {c.kda.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TopChamps;
