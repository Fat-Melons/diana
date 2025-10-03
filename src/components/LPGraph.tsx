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
import { rankToTotalLP, totalLPToRank, formatRank } from "../utils/format";

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
  GOLD: "var(--gold)",
  PLATINUM: "#4cc7b0",
  EMERALD: "var(--win)",
  DIAMOND: "#4da3ff",
  MASTER: "#c06bff",
  GRANDMASTER: "#ff5d5d",
  CHALLENGER: "#67e3ff",
};

const LPGraph: React.FC<LPGraphProps> = ({ ranked_progress, tier }) => {
  const isRanked = !!tier;
  const color = TIER_COLORS[(tier || "EMERALD").toUpperCase()] || "var(--win)";

  const { data, hasExact, yDomain, rankChanges } = useMemo(() => {
    if (!ranked_progress || ranked_progress.length === 0)
      return { data: [], hasExact: false, yDomain: [0, 100], rankChanges: [] };

    const rows = ranked_progress.map((s) => {
      const totalLPAfter = rankToTotalLP(
        s.tier_after,
        s.division_after,
        s.lp_after,
      );

      return {
        label: s.label_index,
        totalLP: totalLPAfter,
        lp: s.lp_after,
        delta: s.lp_delta,
        result: s.result,
        tier_before: s.tier_before,
        division_before: s.division_before,
        tier_after: s.tier_after,
        division_after: s.division_after,
        rankChanged:
          s.tier_before !== s.tier_after ||
          s.division_before !== s.division_after,
        formattedRank: formatRank(s.tier_after, s.division_after),
      };
    });

    const rankChanges = rows.filter((row) => row.rankChanged);

    const allTotalLPs = rows.map((r) => r.totalLP);
    const minLP = Math.min(...allTotalLPs);
    const maxLP = Math.max(...allTotalLPs);
    const padding = Math.max((maxLP - minLP) * 0.1, 50);
    const yDomain = [Math.max(0, minLP - padding), maxLP + padding];

    const hasExact = ranked_progress.some((s) => s.exact);
    return { data: rows, hasExact, yDomain, rankChanges };
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
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              interval={0}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--muted)" }}
              width={50}
              domain={yDomain}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
              tickFormatter={(value) => {
                const rank = totalLPToRank(value);
                return `${rank.lp} LP`;
              }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--text)",
              }}
              labelStyle={{ color: "var(--text)" }}
              labelFormatter={(v: any) => `Game ${v}`}
              formatter={(value: any, _name: string, props: any) => {
                const rank = totalLPToRank(value);
                return [
                  `${formatRank(rank.tier, rank.division)} (${rank.lp} LP)`,
                  props.payload.result === "Win"
                    ? `+${props.payload.delta} LP`
                    : `${props.payload.delta} LP`,
                ];
              }}
            />

            {[0, 400, 800, 1200, 1600, 2000, 2400, 2800]
              .filter((lp) => lp >= yDomain[0] && lp <= yDomain[1])
              .map((lp) => (
                <ReferenceLine
                  key={lp}
                  y={lp}
                  stroke="var(--border)"
                  strokeDasharray="2 2"
                  strokeOpacity={0.5}
                />
              ))}

            <Area
              type="monotone"
              dataKey="totalLP"
              stroke={color}
              strokeWidth={2}
              fill="url(#lpFill)"
            />

            {rankChanges.map((d, i) => (
              <ReferenceDot
                key={`rank-change-${i}`}
                x={d.label}
                y={d.totalLP}
                r={4}
                fill={d.result === "Win" ? "var(--win)" : "var(--loss)"}
                stroke={color}
                strokeWidth={2}
                label={{
                  value: d.formattedRank,
                  position:
                    d.totalLP > yDomain[0] + (yDomain[1] - yDomain[0]) * 0.5
                      ? "bottom"
                      : "top",
                  fill: color,
                  fontSize: 10,
                  fontWeight: 600,
                  offset: 8,
                }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
};

export default LPGraph;
