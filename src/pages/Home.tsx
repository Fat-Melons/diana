import React, { useEffect, useState } from "react";
import { fetchOverview, fetchDailyActivity } from "../lib/api";
import type { PlayerOverview, DailyActivityEntry } from "../types/riot";
import { useAuth } from "../contexts/AuthContext";
import ProfileCard from "../components/ProfileCard";
import MatchList from "../components/MatchList";
import TopChamps from "../components/TopChamps";
import ActivityGraph from "../components/ActivityGraph";
import LoadingSpinner from "../components/LoadingSpinner";

const Home: React.FC = () => {
  const [data, setData] = useState<PlayerOverview | null>(null);
  const [activityData, setActivityData] = useState<DailyActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const res = await fetchOverview(user.name, user.region, user.tag);

        if (res.matches.length === 0) {
          console.warn("[Frontend] ⚠️  No matches received from backend!");
        } else {
          console.debug("[Frontend] ✅ First match:", res.matches[0]);
        }

        setData(res);
        try {
          const activityRes = await fetchDailyActivity(res.profile.puuid);
          setActivityData(activityRes);
        } catch (activityError) {
          console.error("Failed to fetch activity data:", activityError);
        }
      } catch (e: any) {
        console.error("[Frontend] ❌ fetchOverview failed:", e);
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) return <LoadingSpinner />;
  if (error)
    return (
      <div className="container">
        <div className="error">Error: {error}</div>
      </div>
    );
  if (!data) return null;

  const { profile, matches, stats, top_champs } = data;

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
