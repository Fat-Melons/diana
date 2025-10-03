import React from "react";
import type { MatchDetails, MatchParticipant } from "../types/riot";
import MatchTableRow from "./MatchTableRow";

type Team = "Blue" | "Red";

interface TeamGroup {
  team: Team;
  participants: MatchParticipant[];
  won: boolean;
}

interface MatchDetailTableProps {
  match: MatchDetails;
  userPuuid: string;
}

const MatchDetailTable: React.FC<MatchDetailTableProps> = ({
  match,
  userPuuid,
}) => {
  const teams: TeamGroup[] = [
    {
      team: "Blue",
      participants: match.participants.filter((p) => p.team === "Blue"),
      won: match.participants.find((p) => p.team === "Blue")?.win || false,
    },
    {
      team: "Red",
      participants: match.participants.filter((p) => p.team === "Red"),
      won: match.participants.find((p) => p.team === "Red")?.win || false,
    },
  ];

  return (
    <div className="match-detail-table">
      {teams.map((teamGroup) => (
        <div
          key={teamGroup.team}
          className={`team-section ${teamGroup.team.toLowerCase()}-team`}
        >
          <div className="team-header">
            <div className="team-info">
              <span className="team-name">{teamGroup.team} Team</span>
              <span
                className={`team-result ${teamGroup.won ? "victory" : "defeat"}`}
              >
                {teamGroup.won ? "✓ VICTORY" : "✗ DEFEAT"}
              </span>
            </div>
          </div>

          <div className="team-table">
            <div className="table-header">
              <div className="col-header">Champion</div>
              <div className="col-header">Summoner</div>
              <div className="col-header">KDA</div>
              <div className="col-header">KP</div>
              <div className="col-header">CS</div>
              <div className="col-header">Vision</div>
              <div className="col-header">GPM</div>
              <div className="col-header">Damage</div>
              <div className="col-header">Items</div>
            </div>

            <div className="table-body">
              {teamGroup.participants.map((participant) => (
                <MatchTableRow
                  key={participant.puuid}
                  participant={participant}
                  isHighlighted={participant.puuid === userPuuid}
                  ddragonVersion={match.ddragon_version}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MatchDetailTable;
