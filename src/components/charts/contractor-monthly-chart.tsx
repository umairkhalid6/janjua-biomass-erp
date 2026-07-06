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
import { AXIS_TICK, CHART, GRID_STROKE, type TooltipFormatter } from "./palette";
import { compact, tooltipStyle } from "./profit-bar-chart";

const fmt: TooltipFormatter = (v, name) => [formatPKR(Number(v)), String(name)];

export type ContractorMonthlyDatum = {
  label: string;
  earned: number;
  paid: number;
};

// Grouped monthly earned (labor accrued) vs paid.
export function ContractorMonthlyChart({ data }: { data: ContractorMonthlyDatum[] }) {
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
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="earned" name="Earned" fill={CHART.amber} radius={[4, 4, 0, 0]} />
        <Bar dataKey="paid" name="Paid" fill={CHART.green} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
