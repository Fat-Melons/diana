import React from "react";
import type { MatchParticipant } from "../types/riot";
import {
  formatKDA,
  numK,
  killPartPercentage,
  getBaseSummonerName,
} from "../utils/format";
import ItemIcon from "./ItemIcon";
import ItemsGrid from "./ItemGrid";

interface MatchTableRowProps {
  participant: MatchParticipant;
  isHighlighted: boolean;
  ddragonVersion: string;
}

const MatchTableRow: React.FC<MatchTableRowProps> = ({
  participant,
  isHighlighted,
  ddragonVersion,
}) => {
  return (
    <div className={`table-row ${isHighlighted ? "highlighted" : ""}`}>
      <div className="col champion-col">
        <img
          className="champion-icon"
          src={participant.champion_icon_url}
          alt={participant.champion_name}
          loading="lazy"
        />
      </div>

      <div className="col summoner-col">
        <div className="summoner-name">
          <span>{getBaseSummonerName(participant.summoner_name)}</span>
        </div>
      </div>

      <div className="col kda-col">
        <div className="kda-main">
          {formatKDA(
            participant.kills,
            participant.deaths,
            participant.assists,
          )}
        </div>
        <div className="kda-ratio">{participant.kda.toFixed(2)}</div>
      </div>

      <div className="col kp-col">
        <span className="kp-value">
          {killPartPercentage(participant.kill_participation)}
        </span>
      </div>

      <div className="col cs-col">
        <span className="cs-value">{participant.cs_per_min.toFixed(1)}</span>
      </div>

      <div className="col vision-col">
        <span className="vision-value">
          {participant.vision_per_min.toFixed(1)}
        </span>
      </div>

      <div className="col gpm-col">
        <span className="gpm-value">{participant.gpm.toFixed(0)}</span>
      </div>

      <div className="col damage-col">
        <span className="damage-value">{numK(participant.damage_dealt)}</span>
      </div>

      <div className="col items-col">
        <div className="col-main items-main">
          <ItemsGrid slots={participant.items} ver={ddragonVersion} />
          <ItemIcon id={participant.trinket} ver={ddragonVersion} />
        </div>
      </div>
    </div>
  );
};

export default MatchTableRow;
