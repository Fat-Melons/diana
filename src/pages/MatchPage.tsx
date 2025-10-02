import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchMatchDetails, fetchOverview } from "../lib/api";
import type { MatchDetails, PlayerOverview } from "../types/riot";
import MatchDetailTable from "../components/MatchDetailTable";
import RefreshButton from "../components/RefreshButton";
import BackButton from "../components/BackButton";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  queueName,
  timeAgo,
} from "../utils/format";

const formatDurationMin = (s: number) => `${Math.round(s / 60)}m`;

const DEFAULT_USER = { name: "FM Stew", region: "EUW", tag: "RATS" };

const MatchPage: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const [data, setData] = useState<MatchDetails | null>(null);
  const [userProfile, setUserProfile] = useState<PlayerOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) {
      setError("No match ID provided");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const profileRes = await fetchOverview(
          DEFAULT_USER.name,
          DEFAULT_USER.region,
          DEFAULT_USER.tag,
        );
        setUserProfile(profileRes);
        
        const matchRes = await fetchMatchDetails(matchId, profileRes.profile.puuid);
        setData(matchRes);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId]);

  if (loading) return <LoadingSpinner />;

  if (error)
    return (
      <div className="container">
        <div className="error">Error: {error}</div>
      </div>
    );

  if (!data || !userProfile) return null;

  return (
    <>
      <BackButton />
      <RefreshButton />
      <div className="container">
        <div className="match-details">
        <div className="match-header fancy-card">
          <div className="card-head">
            <h2 className="card-title">
              Match Details - {queueName(data.queue_id)}
            </h2>
            <div className="badge">
              {timeAgo(data.game_creation_ms)} • {formatDurationMin(data.game_duration_s)}
            </div>
          </div>
        </div>
        
          <MatchDetailTable 
            match={data} 
            userPuuid={userProfile.profile.puuid} 
          />
        </div>
      </div>
    </>
  );
};

export default MatchPage;