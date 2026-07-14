"use client";

import { ProductionDailyChart } from "@/components/charts/production-daily-chart";
import { useGrain } from "@/components/grain-scope";
import { bucketLabel, bucketStart } from "@/lib/granularity";

export type ProductionOutputRow = { date: string; day: number; night: number };

/**
 * Production output chart (day vs night). The period-window day rows are
 * already on the client, so flipping the grain just re-buckets them locally —
 * no refetch at all.
 */
export function ProductionOutputSection({
  rows,
  multiMonth,
}: {
  rows: ProductionOutputRow[];
  multiMonth: boolean;
}) {
  const grain = useGrain();

  // Day-only labels read cleanly for a single month; across a multi-month
  // window include the month so repeated day numbers stay distinguishable.
  const byBucket = new Map<number, { day: number; night: number }>();
  for (const r of rows) {
    const key = bucketStart(grain, new Date(r.date)).getTime();
    const cur = byBucket.get(key) ?? { day: 0, night: 0 };
    cur.day += r.day;
    cur.night += r.night;
    byBucket.set(key, cur);
  }
  const chartData = Array.from(byBucket.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, v]) => {
      const d = new Date(time);
      return {
        label:
          grain === "daily" && !multiMonth ? String(d.getUTCDate()) : bucketLabel(grain, d),
        day: v.day,
        night: v.night,
      };
    });

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        {grain === "daily" ? "Daily" : grain === "weekly" ? "Weekly" : "Monthly"} Output (day
        vs night)
      </h2>
      {chartData.length > 0 ? (
        <ProductionDailyChart data={chartData} />
      ) : (
        <p className="py-8 text-center text-sm text-neutral-400">No production in this period.</p>
      )}
    </section>
  );
}
