import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import type { RankStep } from "../types/riot";

export type LPGraphProps = {
  ranked_progress: RankStep[];
  currentLP?: number | null;
  tier?: string | null;
  division?: string | null;
};

const TIER_COLORS: Record<string, string> = {
  IRON: "#726f6a",
  BRONZE: "#8c5a3c",
  SILVER: "#9fa9b3",
  GOLD: "#ffd86b",
  PLATINUM: "#4cc7b0",
  EMERALD: "#2aa86f",
  DIAMOND: "#4da3ff",
  MASTER: "#c06bff",
  GRANDMASTER: "#ff5d5d",
  CHALLENGER: "#67e3ff",
};

const LPGraph: React.FC<LPGraphProps> = ({
  ranked_progress,
  currentLP,
  tier,
}) => {
  const isRanked = !!tier;
  const color = TIER_COLORS[(tier || "EMERALD").toUpperCase()] || "#2aa86f";

  const { data, hasExact, boundaries } = useMemo(() => {
    if (!ranked_progress || ranked_progress.length === 0)
      return { data: [], hasExact: false, boundaries: [] as number[] };

    const rows = ranked_progress.map((s) => ({
      label: s.label_index,
      lp: s.lp_after,
      delta: s.lp_delta,
      result: s.result,
      tier_after: s.tier_after,
      division_after: s.division_after,
      changed:
        s.tier_before !== s.tier_after ||
        s.division_before !== s.division_after,
    }));

    const boundaries = rows
      .map((r, i) =>
        i > 0 &&
        (ranked_progress[i].tier_before !== ranked_progress[i].tier_after ||
          ranked_progress[i].division_before !==
            ranked_progress[i].division_after)
          ? i + 1
          : 0,
      )
      .filter((v) => v > 0);

    const hasExact = ranked_progress.some((s) => s.exact);
    return { data: rows, hasExact, boundaries };
  }, [ranked_progress]);

  return (
    <section className="lp-card fancy-card">
      <div className="card-head">
        <h3 className="card-title">LP Trend (last {data.length} games)</h3>
        <div className={`badge small ${hasExact ? "" : "muted"}`}>
          {hasExact ? "Exact" : "Estimated"}
        </div>
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
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
            <YAxis tick={{ fontSize: 12 }} width={32} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: "#0c1323",
                border: "1px solid var(--border)",
              }}
              labelFormatter={(v: any) => `Game ${v}`}
              formatter={(value: any) => [`${value} LP`, "LP"]}
            />
            <ReferenceLine y={0} stroke="#1f2942" />
            <ReferenceLine y={100} stroke="#1f2942" />

            {boundaries.map((x) => (
              <ReferenceLine
                key={x}
                x={x}
                stroke="#1f2942"
                strokeDasharray="3 3"
              />
            ))}

            <Area
              type="monotone"
              dataKey="lp"
              stroke={color}
              fill="url(#lpFill)"
            />
            {data.map((d, i) =>
              d.changed ? (
                <ReferenceDot
                  key={`dot-${i}`}
                  x={d.label}
                  y={d.lp}
                  r={3}
                  stroke={color}
                  label={{
                    value: `${d.tier_after} ${d.division_after}`,
                    position: "top",
                    fill: color,
                    fontSize: 10,
                  }}
                />
              ) : null,
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
};

export default LPGraph;
