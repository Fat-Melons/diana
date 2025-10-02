import React, { useEffect, useState } from "react";
import { fetchOverview, fetchDailyActivity } from "../lib/api";
import type { PlayerOverview, DailyActivityEntry } from "../types/riot";
import ProfileCard from "../components/ProfileCard";
import MatchList from "../components/MatchList";
import TopChamps from "../components/TopChamps";
import ActivityGraph from "../components/ActivityGraph";
import LoadingSpinner from "../components/LoadingSpinner";

const DEFAULT_USER = { name: "FM Stew", region: "EUW", tag: "RATS" };

const Home: React.FC = () => {
  const [data, setData] = useState<PlayerOverview | null>(null);
  const [activityData, setActivityData] = useState<DailyActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchOverview(
          DEFAULT_USER.name,
          DEFAULT_USER.region,
          DEFAULT_USER.tag,
        );
        setData(res);
        try {
          const activityRes = await fetchDailyActivity(res.profile.puuid);
          setActivityData(activityRes);
        } catch (activityError) {
          console.error("Failed to fetch activity data:", activityError);
        }
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="container">
        <div className="error">Error: {error}</div>
      </div>
    );
  if (!data) return null;

  const { profile, matches, stats, top_champs, ranked_progress } = data;

  return (
    <>
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
          stats={stats}
        />

        <ActivityGraph entries={activityData} />

        <TopChamps champs={top_champs} />
      </div>

        <div className="right-col">
          <MatchList matches={matches} />
        </div>
      </div>
    </>
  );
};
 
export default Home;
