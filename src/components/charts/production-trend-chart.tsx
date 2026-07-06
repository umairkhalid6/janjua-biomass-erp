"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, CHART, GRID_STROKE, type TooltipFormatter } from "./palette";
import { compact, tooltipStyle } from "./profit-bar-chart";

const fmt: TooltipFormatter = (v) => [
  `${Number(v).toLocaleString()} bags`,
  "Produced",
];

export type ProductionTrendDatum = { label: string; bags: number };

// 12-month total-bags production trend.
export function ProductionTrendChart({ data }: { data: ProductionTrendDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => compact(v)}
        />
        <Tooltip
          formatter={fmt}
          contentStyle={tooltipStyle}
        />
        <Line
          type="monotone"
          dataKey="bags"
          stroke={CHART.blue}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
