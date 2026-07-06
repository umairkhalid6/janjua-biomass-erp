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
import { AXIS_TICK, CHART, GRID_STROKE, type TooltipFormatter } from "./palette";
import { tooltipStyle } from "./profit-bar-chart";

const fmt: TooltipFormatter = (v, name) => [`${Number(v)} bags`, String(name)];

export type ProductionDailyDatum = {
  label: string; // day of month
  day: number; // day-shift bags
  night: number; // night-shift bags
};

// Stacked day/night bags per day of the selected month.
export function ProductionDailyChart({ data }: { data: ProductionDailyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          formatter={fmt}
          contentStyle={tooltipStyle}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="day" stackId="s" name="Day" fill={CHART.amber} radius={[0, 0, 0, 0]} />
        <Bar dataKey="night" stackId="s" name="Night" fill={CHART.indigo} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
