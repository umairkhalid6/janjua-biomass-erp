"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPKR } from "@/lib/format";
import { AXIS_TICK, GRID_STROKE, SERIES, type TooltipFormatter } from "./palette";
import { compact, tooltipStyle } from "./profit-bar-chart";

const fmt: TooltipFormatter = (v, name) => [formatPKR(Number(v)), String(name)];

export type MaterialSeries = { key: string; label: string };
// Each datum: { label: "Jul 26", <key>: cost, ... }
export type MaterialStackedDatum = { label: string } & Record<string, number | string>;

// 6-month stacked material-cost chart. One stacked bar segment per material type.
export function MaterialStackedChart({
  data,
  series,
}: {
  data: MaterialStackedDatum[];
  series: MaterialSeries[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={54}
          tickFormatter={(v: number) => compact(v)}
        />
        <Tooltip
          formatter={fmt}
          contentStyle={tooltipStyle}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="cost"
            fill={SERIES[i % SERIES.length]}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
