"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPKR } from "@/lib/format";
import { AXIS_TICK, CHART, GRID_STROKE, type TooltipFormatter } from "./palette";

const fmt: TooltipFormatter = (v) => [formatPKR(Number(v)), "Profit"];

export type ProfitBarDatum = { label: string; profit: number };

// Monthly profit bar chart. Bars turn red when profit is negative.
export function ProfitBarChart({ data }: { data: ProfitBarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
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
        <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.profit >= 0 ? CHART.green : CHART.red} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const tooltipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
} as const;

// Compact PKR-ish axis labels (e.g. 1.2M, 340k).
export function compact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1_000)}k`;
  return `${v}`;
}
