import React from "react";
import { useNavigate } from "react-router-dom";
import type { MatchSummary } from "../types/riot";
import {
  queueName,
  timeAgo,
  formatKDA,
  numK,
  killPartPercentage,
  roleIsSupport,
  formatDurationMin,
} from "../utils/format";
import ItemIcon from "./ItemIcon";
import ItemsGrid from "./ItemGrid";

const StatCol: React.FC<{
  label: string;
  value: React.ReactNode;
  title?: string;
}> = ({ label, value, title }) => (
  <div className="col stat" title={title ?? label} aria-label={label}>
    <div className="col-head">
      <span className="label">{label}</span>
    </div>
    <div className="col-main">{value}</div>
  </div>
);

const RoleStat: React.FC<{ match: MatchSummary }> = ({ match }) => {
  const isSup = roleIsSupport(match.role);
  return (
    <StatCol
      label={isSup ? "Vision/min" : "CS/min"}
      value={
        isSup ? (
          <span>{match.vision_per_min.toFixed(1)}</span>
        ) : (
          <span>{match.cs_per_min.toFixed(1)}</span>
        )
      }
      title={
        isSup ? "Vision Score per Minute (Support)" : "Creep Score per Minute"
      }
    />
  );
};

const ChampCell: React.FC<{ match: MatchSummary }> = ({ match }) => (
  <div className="col champ-col">
    <div className="champ-wrap" title={match.champion_name}>
      <img
        className="champ"
        src={match.champion_icon_url}
        alt={match.champion_name}
        loading="lazy"
      />
    </div>
    <div className="sub muted small">
      {timeAgo(match.game_creation_ms)} •{" "}
      {formatDurationMin(match.game_duration_s)}
    </div>
  </div>
);

const MetaCol: React.FC<{ match: MatchSummary }> = ({ match }) => (
  <div className="col meta-col">
    <div className="col-head">
      <span className="label">Match</span>
    </div>
    <div className="col-main">
      <div className="queue" title={`Queue: ${queueName(match.queue_id)}`}>
        {queueName(match.queue_id)}
      </div>
    </div>
  </div>
);

const KDACol: React.FC<{ match: MatchSummary }> = ({ match }) => (
  <StatCol
    label="K/D/A"
    value={
      <>
        <div className="kda">
          {formatKDA(match.kills, match.deaths, match.assists)}
        </div>
        <div className="muted small">{match.kda.toFixed(2)} KDA</div>
      </>
    }
    title="Kills / Deaths / Assists"
  />
);

const GPMCol: React.FC<{ match: MatchSummary }> = ({ match }) => (
  <StatCol
    label="GPM"
    value={<div className="gold">{match.gpm.toFixed(1)}</div>}
    title="Gold Per Minute"
  />
);

const KPCol: React.FC<{ match: MatchSummary }> = ({ match }) => (
  <StatCol
    label="KP"
    value={
      <div className="big">{killPartPercentage(match.kill_participation)}</div>
    }
    title="Kill Participation"
  />
);

const DamageCol: React.FC<{ match: MatchSummary }> = ({ match }) => (
  <StatCol
    label="Damage"
    value={<div className="big">{numK(match.damage_dealt)}</div>}
    title="Damage Dealt to Champions"
  />
);

const ItemsCol: React.FC<{ match: MatchSummary }> = ({ match }) => (
  <div className="col items-col">
    <div className="col-head">
      <span className="label">Items</span>
    </div>
    <div className="col-main items-main">
      <ItemsGrid slots={match.items} ver={match.ddragon_version} />
      <ItemIcon id={match.trinket} ver={match.ddragon_version} />
    </div>
  </div>
);

const MatchRow: React.FC<{ match: MatchSummary }> = ({ match }) => {
  const navigate = useNavigate();
  const resultClass = match.win
    ? "win"
    : match.game_duration_s <= 300
      ? "remake"
      : "loss";

  const handleClick = () => {
    navigate(`/match/${match.match_id}`);
  };

  return (
    <div className={`match-row ${resultClass} clickable`} onClick={handleClick}>
      <ChampCell match={match} />
      <MetaCol match={match} />
      <KDACol match={match} />
      <GPMCol match={match} />
      <KPCol match={match} />
      <DamageCol match={match} />
      <RoleStat match={match} />
      <ItemsCol match={match} />
    </div>
  );
};

export default MatchRow;
