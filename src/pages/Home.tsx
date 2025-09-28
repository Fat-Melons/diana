import React, { useEffect, useState } from "react";
import { fetchOverview } from "../lib/api";
import type { PlayerOverview } from "../types/riot";
import ProfileCard from "../components/ProfileCard";
import MatchList from "../components/MatchList";

const DEFAULT_USER = { name: "FM Stew", region: "EUW", tag: "RATS" };

const Home: React.FC = () => {
  const [data, setData] = useState<PlayerOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchOverview(DEFAULT_USER.name, DEFAULT_USER.region, DEFAULT_USER.tag);
        setData(res);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="container"><div className="muted">Loading…</div></div>;
  if (error) return <div className="container"><div className="error">Error: {error}</div></div>;
  if (!data) return null;

  const { profile, matches } = data;

  return (
    <div className="container grid">
      <div className="left-col">
        <ProfileCard
          name={profile.name}
          tagline={profile.tagline}
          region={profile.region}
          level={profile.summoner_level}
          profileIconUrl={profile.profile_icon_url}
          tier={profile.tier}
          division={profile.division}
          lp={profile.lp ?? 0}
        />
      </div>
      <div className="right-col">
        <MatchList matches={matches} />
      </div>
    </div>
  );
};

export default Home;
