import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  formatDate,
  formatPKR,
  parsePeriodParam,
  periodLabel,
  periodRange,
} from "@/lib/format";
import { BAG_KG } from "@/lib/constants";
import { PeriodPicker } from "@/components/period-picker";
import { ProductionDailyChart } from "@/components/charts/production-daily-chart";
import { ProductionTrendChart } from "@/components/charts/production-trend-chart";

type DailyRow = {
  date: Date;
  day_bags: string | number;
  night_bags: string | number;
  labor_cost: string | number;
};
type TrendRow = { month: Date; total_bags: string | number };

export default async function ProductionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const period = parsePeriodParam(sp.period);
  const { gte, lte } = periodRange(period);

  const [daily, trend] = await Promise.all([
    prisma.$queryRaw<DailyRow[]>`
      SELECT p.date,
             p."dayShiftBags"  AS day_bags,
             p."nightShiftBags" AS night_bags,
             COALESCE(l.labor_cost, 0) AS labor_cost
      FROM production_days p
      LEFT JOIN v_labor_daily l ON l.date = p.date
      WHERE p.date >= ${gte}::date AND p.date <= ${lte}::date
      ORDER BY p.date ASC
    `,
    prisma.$queryRaw<TrendRow[]>`
      SELECT month, total_bags FROM v_production_summary
      ORDER BY month DESC LIMIT 12
    `,
  ]);

  const rows = daily.map((r) => {
    const dayBags = Number(r.day_bags);
    const nightBags = Number(r.night_bags);
    const total = dayBags + nightBags;
    return {
      date: new Date(r.date),
      dayBags,
      nightBags,
      total,
      kg: total * BAG_KG,
      laborCost: Number(r.labor_cost),
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      dayBags: acc.dayBags + r.dayBags,
      nightBags: acc.nightBags + r.nightBags,
      total: acc.total + r.total,
      kg: acc.kg + r.kg,
      laborCost: acc.laborCost + r.laborCost,
    }),
    { dayBags: 0, nightBags: 0, total: 0, kg: 0, laborCost: 0 }
  );

  // Day-only labels read cleanly for a single month; across a multi-month
  // window include the month so repeated day numbers stay distinguishable.
  const multiMonth = period !== "1m";
  const dailyChart = rows.map((r) => ({
    label: multiMonth
      ? r.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
      : String(r.date.getUTCDate()),
    day: r.dayBags,
    night: r.nightBags,
  }));

  const trendChart = trend
    .map((r) => ({ month: new Date(r.month), bags: Number(r.total_bags) }))
    .sort((a, b) => a.month.getTime() - b.month.getTime())
    .map((r) => ({
      label: r.month.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      bags: r.bags,
    }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Production</h1>
          <p className="mt-0.5 text-sm text-neutral-500">{periodLabel(period)}</p>
        </div>
        <Suspense>
          <PeriodPicker value={period} />
        </Suspense>
      </div>

      {/* Daily chart */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Daily Output (day vs night)
        </h2>
        {dailyChart.length > 0 ? (
          <ProductionDailyChart data={dailyChart} />
        ) : (
          <p className="py-8 text-center text-sm text-neutral-400">No production in this period.</p>
        )}
      </section>

      {/* Daily table */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Day</th>
                <th className="px-4 py-3 text-right font-medium">Night</th>
                <th className="px-4 py-3 text-right font-medium">Total Bags</th>
                <th className="px-4 py-3 text-right font-medium">KG</th>
                <th className="px-4 py-3 text-right font-medium">Labor Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-neutral-400">
                    No production recorded in this period.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.date.toISOString()} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                    {r.dayBags.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                    {r.nightBags.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {r.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500">
                    {r.kg.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                    {formatPKR(r.laborCost)}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-50">Total</td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totals.dayBags.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totals.nightBags.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totals.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totals.kg.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {formatPKR(totals.laborCost)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Trend */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Production Trend (12 months)
        </h2>
        {trendChart.length > 0 ? (
          <ProductionTrendChart data={trendChart} />
        ) : (
          <p className="py-8 text-center text-sm text-neutral-400">No history yet.</p>
        )}
      </section>
    </div>
  );
}
