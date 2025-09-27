import React from "react";
import type { MatchSummary } from "../types/riot";
import { queueName, timeAgo, formatKDA } from "../utils/format";

const MatchRow: React.FC<{ match: MatchSummary }> = ({ match }) => {
  const resultClass = match.win ? "win" : "loss";
  return (
    <div className={`match-row ${resultClass}`}>
      <div className="left">
        <img className="champ" src={match.champion_icon_url} alt={match.champion_name} />
        <div>
          <div className="queue">{queueName(match.queue_id)}</div>
          <div className="muted small">{timeAgo(match.game_creation_ms)} • {Math.round(match.game_duration_s / 60)}m</div>
        </div>
      </div>

      <div className="mid">
        <div className="kda">{formatKDA(match.kills, match.deaths, match.assists)}</div>
        <div className="muted small">{match.kda.toFixed(2)} KDA</div>
      </div>

      <div className="right">
        <div className="stat">CS {match.cs}</div>
        <div className={`result ${resultClass}`}>{match.win ? "Victory" : "Defeat"}</div>
      </div>
    </div>
  );
};

export default MatchRow;
