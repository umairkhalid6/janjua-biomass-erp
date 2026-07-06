"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPKR } from "@/lib/format";
import { AXIS_TICK, CHART, GRID_STROKE, type TooltipFormatter } from "./palette";
import { compact, tooltipStyle } from "./profit-bar-chart";

const fmt: TooltipFormatter = (v) => [formatPKR(Number(v)), "Profit"];

export type ProfitTrendDatum = { label: string; profit: number };

// Compact 6-month profit trend (dashboard).
export function ProfitTrendChart({ data }: { data: ProfitTrendDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.green} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART.green} stopOpacity={0} />
          </linearGradient>
        </defs>
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
        <Area
          type="monotone"
          dataKey="profit"
          stroke={CHART.green}
          strokeWidth={2}
          fill="url(#profitFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
