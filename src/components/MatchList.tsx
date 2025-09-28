import React from "react";
import type { MatchSummary } from "../types/riot";
import MatchRow from "./MatchRow";

const MatchList: React.FC<{ matches: MatchSummary[] }> = ({ matches }) => {
  return (
    <section className="match-list">
      <h3>Recent Matches</h3>
      {matches.map((m) => (
        <MatchRow key={m.match_id} match={m} />
      ))}
      {matches.length === 0 && <div className="muted">No matches found.</div>}
    </section>
  );
};

export default MatchList;
