"use client";

import { fetchPnlHistory, type ProfitPoint } from "@/app/(app)/chart-actions";
import { ProfitBarChart } from "@/components/charts/profit-bar-chart";
import { useGrainData } from "@/components/grain-scope";
import { formatPKR } from "@/lib/format";
import {
  bucketLabel,
  bucketLabelLong,
  defaultGrainBuckets,
  grainWindowLabel,
} from "@/lib/granularity";

/**
 * P&L profit history — chart plus history table. Both follow the page's
 * GrainScope; flipping the grain refetches only this history series.
 */
export function PnlHistorySection({ initialData }: { initialData: ProfitPoint[] }) {
  const { grain, data, pending } = useGrainData(initialData, fetchPnlHistory);
  const buckets = defaultGrainBuckets(grain);
  const rows = data.map((p) => ({ bucket: new Date(p.bucket), profit: p.profit }));
  const chartData = rows.map((r) => ({
    label: bucketLabel(grain, r.bucket),
    profit: r.profit,
  }));
  const grainNoun = grain === "daily" ? "Day" : grain === "weekly" ? "Week" : "Month";

  return (
    <>
      {/* Profit chart */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Profit — {grainWindowLabel(grain, buckets)}
        </h2>
        <div className={`transition-opacity ${pending ? "opacity-50" : ""}`} aria-busy={pending}>
          {chartData.length > 0 ? (
            <ProfitBarChart data={chartData} />
          ) : (
            <p className="py-8 text-center text-sm text-neutral-400">No history yet.</p>
          )}
        </div>
      </section>

      {/* History table */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Profit History ({grainWindowLabel(grain, buckets)})
          </h2>
        </div>
        <div
          className={`overflow-x-auto transition-opacity ${pending ? "opacity-50" : ""}`}
          aria-busy={pending}
        >
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">{grainNoun}</th>
                <th className="px-4 py-3 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-sm text-neutral-400">
                    No history yet.
                  </td>
                </tr>
              )}
              {[...rows].reverse().map((r) => (
                <tr key={r.bucket.toISOString()} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {bucketLabelLong(grain, r.bucket)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-medium ${
                      r.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatPKR(r.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
