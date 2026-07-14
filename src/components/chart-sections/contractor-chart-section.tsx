"use client";

import {
  fetchContractorEarnedPaid,
  type EarnedPaidPoint,
} from "@/app/(app)/chart-actions";
import { ContractorMonthlyChart } from "@/components/charts/contractor-monthly-chart";
import { useGrainData } from "@/components/grain-scope";
import {
  bucketLabel,
  defaultGrainBuckets,
  grainWindowLabel,
} from "@/lib/granularity";

/** Contractor earned-vs-paid chart: grain changes refetch only this series. */
export function ContractorChartSection({
  initialData,
}: {
  initialData: EarnedPaidPoint[];
}) {
  const { grain, data, pending } = useGrainData(initialData, fetchContractorEarnedPaid);
  const chartData = data.map((p) => ({
    label: bucketLabel(grain, new Date(p.bucket)),
    earned: p.earned,
    paid: p.paid,
  }));

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
        Earned vs Paid ({grainWindowLabel(grain, defaultGrainBuckets(grain))})
      </h2>
      <div className={`transition-opacity ${pending ? "opacity-50" : ""}`} aria-busy={pending}>
        {chartData.length > 0 ? (
          <ContractorMonthlyChart data={chartData} />
        ) : (
          <p className="py-8 text-center text-sm text-neutral-400">No history yet.</p>
        )}
      </div>
    </section>
  );
}
