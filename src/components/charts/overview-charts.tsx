"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPKR } from "@/lib/format";
import { AXIS_TICK, CHART, GRID_STROKE, SERIES, type TooltipFormatter } from "./palette";
import { compact, tooltipStyle } from "./profit-bar-chart";

const pkr: TooltipFormatter = (v, name) => [formatPKR(Number(v)), String(name)];
const bags: TooltipFormatter = (v, name) => [`${Number(v).toLocaleString()} bags`, String(name)];

export type MonthMoney = {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
};

// Revenue vs cost as grouped bars with the profit line riding on top, so the
// margin is readable against the two figures that produce it.
export function RevenueCostProfitChart({ data }: { data: MonthMoney[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
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
        <Tooltip formatter={pkr} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="revenue" name="Revenue" fill={CHART.blue} radius={[4, 4, 0, 0]} maxBarSize={44} />
        <Bar dataKey="cost" name="Total cost" fill={CHART.amber} radius={[4, 4, 0, 0]} maxBarSize={44} />
        <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.profit >= 0 ? CHART.green : CHART.red} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export type CostMixDatum = { label: string } & Record<string, number | string>;

export const COST_SERIES = [
  { key: "sawdust", label: "Sawdust" },
  { key: "chips", label: "Wood chips" },
  { key: "labor", label: "Contractor" },
  { key: "electricity", label: "Electricity" },
  { key: "expenses", label: "Maintenance / other" },
] as const;

export function CostMixChart({ data }: { data: CostMixDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
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
        <Tooltip formatter={pkr} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {COST_SERIES.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="cost"
            fill={SERIES[i % SERIES.length]}
            radius={i === COST_SERIES.length - 1 ? [4, 4, 0, 0] : undefined}
            maxBarSize={64}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export type DailyProductionDatum = {
  date: string;
  day: number;
  night: number;
  total: number;
};

// Daily output across the whole window. Stacked so the night shift (which only
// starts mid-June) reads as added capacity rather than a separate series.
export function DailyProductionChart({ data }: { data: DailyProductionDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
        <Tooltip formatter={bags} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="day"
          name="Day shift"
          stackId="p"
          stroke={CHART.teal}
          fill={CHART.teal}
          fillOpacity={0.25}
        />
        <Area
          type="monotone"
          dataKey="night"
          name="Night shift"
          stackId="p"
          stroke={CHART.indigo}
          fill={CHART.indigo}
          fillOpacity={0.25}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export type ProducedSoldDatum = { label: string; produced: number; sold: number };

export function ProducedVsSoldChart({ data }: { data: ProducedSoldDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={46} />
        <Tooltip formatter={bags} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="produced" name="Produced" fill={CHART.teal} radius={[4, 4, 0, 0]} maxBarSize={44} />
        <Bar dataKey="sold" name="Sold" fill={CHART.blue} radius={[4, 4, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export type RateDatum = { label: string; rate: number; costPerBag: number };

// Selling rate against unit cost — the two lines converging is the margin story.
export function RateVsCostChart({ data }: { data: RateDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={54}
          domain={["dataMin - 200", "dataMax + 200"]}
          tickFormatter={(v: number) => compact(v)}
        />
        <Tooltip formatter={pkr} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="rate"
          name="Avg sale rate / bag"
          stroke={CHART.blue}
          strokeWidth={2}
          dot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="costPerBag"
          name="Cost / bag produced"
          stroke={CHART.amber}
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type CategoryDatum = { label: string; value: number };

// Horizontal bars: expense categories and top customers have long labels and
// an obvious ranking, which a vertical bar chart handles badly.
export function HorizontalBarChart({
  data,
  color = CHART.slate,
  unit = "PKR",
}: {
  data: CategoryDatum[];
  color?: string;
  unit?: "PKR" | "bags";
}) {
  const fmt: TooltipFormatter =
    unit === "bags"
      ? (v) => [`${Number(v).toLocaleString()} bags`, ""]
      : (v) => [formatPKR(Number(v)), ""];
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34 + 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (unit === "bags" ? String(v) : compact(v))}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip formatter={fmt} contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
