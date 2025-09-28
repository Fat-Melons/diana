import React from "react";
import { rankEmblemFromTier } from "../utils/format";

export type ProfileProps = {
  name: string;
  tagline?: string | null;
  region: string;
  level: number;
  profileIconUrl: string;
  tier?: string | null;
  division?: string | null;
  lp?: number | null;
  stats?: {
    winrate?: number;
    games?: number;
    streak?: number;
    kda?: number;
  };
};

const ProfileCard: React.FC<ProfileProps> = ({
  name,
  tagline,
  region,
  level,
  profileIconUrl,
  tier,
  division,
  lp,
  stats,
}) => {
  const emblem = rankEmblemFromTier(tier);
  const rankLine = tier ? `${tier} ${division ?? ""}`.trim() : "Unranked";
  const streakStr =
    stats?.streak && stats.streak !== 0
      ? stats.streak > 0
        ? `W${stats.streak}`
        : `L${Math.abs(stats.streak)}`
      : undefined;

  return (
    <aside className="profile-card fancy-card">
      <div className="profile-header">
        <div className="avatar-wrap">
          <img
            className="profile-icon"
            src={profileIconUrl}
            alt="Profile icon"
          />
          {streakStr && (
            <div
              className={`streak-badge ${stats!.streak! > 0 ? "win" : "loss"}`}
            >
              {streakStr}
            </div>
          )}
        </div>

        <div className="profile-meta">
          <h2 className="profile-name">
            <div>{name}</div>
            <div className="tag">
              {tagline ? <span>#{tagline}</span> : null}
            </div>
          </h2>
          <div className="muted">
            {region} • Level {level}
          </div>
        </div>
      </div>

      <div className="profile-rank">
        {emblem && (
          <img className="rank-emblem" src={emblem} alt={`${tier} emblem`} />
        )}
        <div className="rank-line">{rankLine}</div>
        {tier && <div className="lp-line">{lp ?? 0} LP</div>}
      </div>
      <div className="profile-quick">
        <div className="quick-pill">
          <span className="label">Winrate</span>
          <span className="value">{stats?.winrate ?? 0}%</span>
        </div>
        <div className="quick-pill">
          <span className="label">Games</span>
          <span className="value">{stats?.games ?? 0}</span>
        </div>
        <div className="quick-pill">
          <span className="label">Avg KDA</span>
          <span className="value">{(stats?.kda ?? 0).toFixed(2)}</span>
        </div>
      </div>
    </aside>
  );
};

export default ProfileCard;
