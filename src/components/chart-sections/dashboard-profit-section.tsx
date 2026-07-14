"use client";

import {
  fetchDashboardProfitTrend,
  type ProfitPoint,
} from "@/app/(app)/chart-actions";
import { ProfitTrendChart } from "@/components/charts/profit-trend-chart";
import { ScopedGrainPicker, useGrainData } from "@/components/grain-scope";
import {
  bucketLabel,
  defaultGrainBuckets,
  grainWindowLabel,
} from "@/lib/granularity";

/** Dashboard profit card: flipping the grain refetches only this series. */
export function DashboardProfitSection({ initialData }: { initialData: ProfitPoint[] }) {
  const { grain, data, pending } = useGrainData(initialData, fetchDashboardProfitTrend);
  // Monthly keeps the original 6-month window; day/week use standard windows.
  const buckets = grain === "monthly" ? 6 : defaultGrainBuckets(grain);
  const trend = data.map((p) => ({
    label: bucketLabel(grain, new Date(p.bucket)),
    profit: p.profit,
  }));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 lg:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Profit — {grainWindowLabel(grain, buckets)}
        </p>
        <ScopedGrainPicker />
      </div>
      <div className={`transition-opacity ${pending ? "opacity-50" : ""}`} aria-busy={pending}>
        {trend.length > 0 ? (
          <ProfitTrendChart data={trend} />
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-neutral-400">
            No data yet.
          </div>
        )}
      </div>
    </div>
  );
}
