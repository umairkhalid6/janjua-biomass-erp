"use client";

import {
  fetchProductionTrend,
  type ProductionTrendPoint,
} from "@/app/(app)/chart-actions";
import { ProductionTrendChart } from "@/components/charts/production-trend-chart";
import { useGrainData } from "@/components/grain-scope";
import {
  bucketLabel,
  defaultGrainBuckets,
  grainWindowLabel,
} from "@/lib/granularity";

/** Production trend chart: flipping the grain refetches only this series. */
export function ProductionTrendSection({
  initialData,
}: {
  initialData: ProductionTrendPoint[];
}) {
  const { grain, data, pending } = useGrainData(initialData, fetchProductionTrend);
  const chartData = data.map((p) => ({
    label: bucketLabel(grain, new Date(p.bucket)),
    bags: p.bags,
  }));

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        Production Trend ({grainWindowLabel(grain, defaultGrainBuckets(grain))})
      </h2>
      <div className={`transition-opacity ${pending ? "opacity-50" : ""}`} aria-busy={pending}>
        {chartData.length > 0 ? (
          <ProductionTrendChart data={chartData} />
        ) : (
          <p className="py-8 text-center text-sm text-neutral-400">No history yet.</p>
        )}
      </div>
    </section>
  );
}
