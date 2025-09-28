import React from "react";
import type { MatchSummary } from "../types/riot";
import {
  queueName,
  timeAgo,
  formatKDA,
  getRoleNameTranslation,
} from "../utils/format";

const numK = (n: number) => {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "k";
  return `${n}`;
};

const pct0 = (p: number) => `${Math.round(p * 100)}%`;

const itemIconUrl = (id: number, ver: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${ver}/img/item/${id}.png`;

const roleIsSupport = (role: string) => role?.toUpperCase() === "UTILITY";

const Trinket: React.FC<{ id: number; ver: string }> = ({ id, ver }) => {
  if (!id)
    return (
      <span
        className="trinket empty"
        title="No trinket equipped"
        aria-label="No trinket"
      />
    );
  return (
    <img
      className="trinket"
      src={itemIconUrl(id, ver)}
      alt="Trinket"
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
};

const ItemsGrid: React.FC<{ slots: number[]; ver: string }> = ({
  slots,
  ver,
}) => {
  const six = [...slots];
  while (six.length < 6) six.push(0);

  return (
    <div className="items-grid" aria-label="Items">
      {six.map((id, i) =>
        id > 0 ? (
          <img
            key={i}
            className="item"
            src={itemIconUrl(id, ver)}
            alt={`Item ${id}`}
            loading="lazy"
            title={`Item ID ${id}`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <div key={i} className="item empty" aria-hidden="true" />
        ),
      )}
    </div>
  );
};

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

const formatDurationMin = (s: number) => `${Math.round(s / 60)}m`;

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
    value={<div className="big">{pct0(match.kill_participation)}</div>}
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
      <Trinket id={match.trinket} ver={match.ddragon_version} />
    </div>
  </div>
);

const MatchRow: React.FC<{ match: MatchSummary }> = ({ match }) => {
  const resultClass = match.win
    ? "win"
    : match.game_duration_s <= 300
      ? "remake"
      : "loss";

  return (
    <div className={`match-row ${resultClass}`}>
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
