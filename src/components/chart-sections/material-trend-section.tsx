"use client";

import {
  fetchMaterialTrend,
  type MaterialTrendPoint,
} from "@/app/(app)/chart-actions";
import {
  MaterialStackedChart,
  type MaterialStackedDatum,
} from "@/components/charts/material-stacked-chart";
import { useGrainData } from "@/components/grain-scope";
import { MATERIAL_LABELS } from "@/lib/constants";
import {
  bucketLabel,
  defaultGrainBuckets,
  grainWindowLabel,
} from "@/lib/granularity";

/** Material cost stacked chart: flipping the grain refetches only this series. */
export function MaterialTrendSection({
  initialData,
}: {
  initialData: MaterialTrendPoint[];
}) {
  const { grain, data, pending } = useGrainData(initialData, fetchMaterialTrend);
  // Monthly keeps the original 6-month window; day/week use standard windows.
  const buckets = grain === "monthly" ? 6 : defaultGrainBuckets(grain);

  // One series per material type present in the window.
  const typesPresent = Array.from(new Set(data.map((r) => r.materialType)));
  const series = typesPresent.map((t) => ({
    key: t,
    label: MATERIAL_LABELS[t] ?? t,
  }));

  const byBucket = new Map<string, MaterialStackedDatum>();
  for (const r of data) {
    const d = new Date(r.bucket);
    const key = r.bucket.slice(0, 10);
    if (!byBucket.has(key)) {
      const base: MaterialStackedDatum = { label: bucketLabel(grain, d) };
      for (const t of typesPresent) base[t] = 0;
      byBucket.set(key, base);
    }
    byBucket.get(key)![r.materialType] = r.cost;
  }
  const chartData = Array.from(byBucket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        Material Cost ({grainWindowLabel(grain, buckets)})
      </h2>
      <div className={`transition-opacity ${pending ? "opacity-50" : ""}`} aria-busy={pending}>
        {chartData.length > 0 ? (
          <MaterialStackedChart data={chartData} series={series} />
        ) : (
          <p className="py-8 text-center text-sm text-neutral-400">No history yet.</p>
        )}
      </div>
    </section>
  );
}
