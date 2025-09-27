import React from "react";
import { rankEmblemFromTier } from "../utils/format";

type Props = {
  name: string;
  tagline?: string | null;
  region: string;
  level: number;
  profileIconUrl: string;
  tier?: string | null;
  division?: string | null;
  lp?: number | null;
};

const ProfileCard: React.FC<Props> = ({
  name, tagline, region, level, profileIconUrl,
  tier, division, lp
}) => {
  const emblem = rankEmblemFromTier(tier);
  const rankLine = tier ? `${tier} ${division ?? ""}`.trim() : "Unranked";

  return (
    <aside className="profile-card">
      <div className="profile-header">
        <img className="profile-icon" src={profileIconUrl} alt="Profile icon" />
        {emblem && <img className="rank-emblem" src={emblem} alt={`${tier} emblem`} />}
      </div>

      <div className="profile-meta">
        <h2 className="profile-name">
          {name}{tagline ? <span className="tag">#{tagline}</span> : null}
        </h2>
        <div className="muted">{region} • Level {level}</div>
      </div>

      <div className="profile-rank">
        <div className="rank-line">{rankLine}</div>
        {tier && <div className="lp-line">{lp ?? 0} LP</div>}
      </div>
    </aside>
  );
};

export default ProfileCard;
