import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { MatchSummary } from "../types/riot";

export type LPGraphProps = {
  matches: MatchSummary[];
  currentLP?: number | null;
  tier?: string | null;
  division?: string | null;
};

const RANKED_SOLO = 420;

const LPGraph: React.FC<LPGraphProps> = ({ matches, currentLP, tier }) => {
  const { data, hasExact } = useMemo(() => buildSeries(matches, currentLP ?? undefined), [matches, currentLP]);
  const isRanked = !!tier;

  return (
    <section className="lp-card fancy-card">
      <div className="card-head">
        <h3 className="card-title">LP Trend (last {data.length} games)</h3>
        <div className="badge small {hasExact ? '' : 'muted'}">{hasExact ? "Exact" : "Estimated"}</div>
      </div>

      {!isRanked ? (
        <div className="muted small">No ranked data yet.</div>
      ) : data.length === 0 ? (
        <div className="muted small">No recent Ranked Solo games found.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="lpFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2aa86f" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#2aa86f" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
            <YAxis tick={{ fontSize: 12 }} width={32} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "#0c1323", border: "1px solid var(--border)" }}
              labelFormatter={(v: any) => `Game ${v}`}
            />
            <ReferenceLine y={0} stroke="#1f2942" />
            <Area type="monotone" dataKey="lp" stroke="#2aa86f" fill="url(#lpFill)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
};

export default LPGraph;

function buildSeries(matches: MatchSummary[], currentLP?: number) {
  const ranked = matches.filter((m) => (m.queueId ?? m.queue_id) === RANKED_SOLO && m.result !== "Remake").slice(0, 10);
  const ordered = [...ranked].reverse();

  let lp = currentLP ?? 0;
  const rows: any[] = [];
  const deltas = ordered.map(m => inferDelta(m));
  const total = deltas.reduce((a, b) => a + b, 0);
  let startLP = typeof currentLP === "number" ? Math.max(0, currentLP - total) : 0;

  for (let i = 0; i < ordered.length; i++) {
    const d = deltas[i];
    startLP = Math.max(0, Math.min(100, startLP + d));
    rows.push({ label: i + 1, lp: startLP, delta: d, result: ordered[i].result });
  }
  const hasExact = ordered.some((m) => typeof (m as any).lpDelta === "number");
  return { data: rows, hasExact };
}

function inferDelta(m: MatchSummary) {
  if (typeof (m as any).lpDelta === "number") return (m as any).lpDelta as number;
  if (m.result === "Win") return 15;
  if (m.result === "Loss") return -15;
  return 0;
}
