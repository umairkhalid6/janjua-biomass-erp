import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  formatMonth,
  formatPKR,
  parsePeriodParam,
  periodLabel,
  periodRange,
} from "@/lib/format";
import { PeriodPicker } from "@/components/period-picker";
import { ProfitBarChart } from "@/components/charts/profit-bar-chart";

// Period totals: v_monthly_summary is month-grain, so the P&L for a window is a
// SUM over its months. avg_rate_per_bag is re-derived from period totals.
type PnlTotalsRow = {
  sales_revenue: string | number;
  loading_charges: string | number;
  bags_sold: string | number;
  avg_rate_per_bag: string | number;
  bags_produced: string | number;
  sawdust_cost: string | number;
  chips_cost: string | number;
  labor_cost: string | number;
  expenses: string | number;
  electricity_cost: string | number;
  total_cost: string | number;
  profit: string | number;
};

export default async function PnlPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const period = parsePeriodParam(sp.period);
  const { gte, lte } = periodRange(period);

  const [current, history] = await Promise.all([
    prisma.$queryRaw<PnlTotalsRow[]>`
      SELECT
        COALESCE(SUM(sales_revenue), 0)     AS sales_revenue,
        COALESCE(SUM(loading_charges), 0)   AS loading_charges,
        COALESCE(SUM(bags_sold), 0)         AS bags_sold,
        CASE WHEN SUM(bags_sold) > 0
             THEN ROUND(SUM(sales_revenue) / SUM(bags_sold), 2)
             ELSE 0 END                     AS avg_rate_per_bag,
        COALESCE(SUM(bags_produced), 0)     AS bags_produced,
        COALESCE(SUM(sawdust_cost), 0)      AS sawdust_cost,
        COALESCE(SUM(chips_cost), 0)        AS chips_cost,
        COALESCE(SUM(labor_cost), 0)        AS labor_cost,
        COALESCE(SUM(expenses), 0)          AS expenses,
        COALESCE(SUM(electricity_cost), 0)  AS electricity_cost,
        COALESCE(SUM(total_cost), 0)        AS total_cost,
        COALESCE(SUM(profit), 0)            AS profit
      FROM v_monthly_summary
      WHERE month >= ${gte}::date AND month <= ${lte}::date
    `,
    prisma.$queryRaw<{ month: Date; profit: string | number }[]>`
      SELECT month, profit FROM v_monthly_summary ORDER BY month DESC LIMIT 12
    `,
  ]);

  const s = current[0];
  const n = (v: string | number | undefined) => Number(v ?? 0);
  const sales = n(s?.sales_revenue);
  const loadingCharges = n(s?.loading_charges);
  const profit = n(s?.profit);
  // The P&L table is empty only when the window has no activity at all.
  const hasData = sales !== 0 || n(s?.total_cost) !== 0 || n(s?.bags_produced) !== 0;

  const costLines = [
    { label: "Sawdust", value: n(s?.sawdust_cost) },
    { label: "Wood Chips", value: n(s?.chips_cost) },
    { label: "Labor (Contractor)", value: n(s?.labor_cost) },
    { label: "Expenses", value: n(s?.expenses) },
    { label: "Electricity", value: n(s?.electricity_cost) },
  ];

  const historyRows = history
    .map((r) => ({ month: new Date(r.month), profit: n(r.profit) }))
    .sort((a, b) => a.month.getTime() - b.month.getTime());

  const chartData = historyRows.map((r) => ({
    label: r.month.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    profit: r.profit,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Profit &amp; Loss
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">{periodLabel(period)}</p>
        </div>
        <Suspense>
          <PeriodPicker value={period} />
        </Suspense>
      </div>

      {/* P&L table */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            <tr className="bg-blue-50/60 dark:bg-blue-950/30">
              <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-50">
                Sales Revenue
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  {n(s?.bags_sold).toLocaleString()} bags @ {formatPKR(n(s?.avg_rate_per_bag))}/bag avg
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-blue-700 dark:text-blue-400">
                {formatPKR(sales)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 pl-8 text-neutral-600 dark:text-neutral-400">
                Loading charges collected
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  pass-through, not in profit
                </span>
              </td>
              <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                {formatPKR(loadingCharges)}
              </td>
            </tr>
            {costLines.map((c) => (
              <tr key={c.label}>
                <td className="px-4 py-2.5 pl-8 text-neutral-600 dark:text-neutral-400">{c.label}</td>
                <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                  ({formatPKR(c.value)})
                </td>
              </tr>
            ))}
            <tr className="bg-amber-50/60 dark:bg-amber-950/30">
              <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-50">Total Cost</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-700 dark:text-amber-400">
                ({formatPKR(n(s?.total_cost))})
              </td>
            </tr>
            <tr
              className={
                profit >= 0
                  ? "bg-green-50 dark:bg-green-950/40"
                  : "bg-red-50 dark:bg-red-950/40"
              }
            >
              <td className="px-4 py-3.5 text-base font-bold text-neutral-900 dark:text-neutral-50">
                {profit >= 0 ? "Profit" : "Loss"}
              </td>
              <td
                className={`px-4 py-3.5 text-right text-base font-bold ${
                  profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatPKR(profit)}
              </td>
            </tr>
          </tbody>
        </table>
        {!hasData && (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">
            No data for {periodLabel(period).toLowerCase()}.
          </p>
        )}
      </section>

      {/* Profit chart */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Monthly Profit
        </h2>
        {chartData.length > 0 ? (
          <ProfitBarChart data={chartData} />
        ) : (
          <p className="py-8 text-center text-sm text-neutral-400">No history yet.</p>
        )}
      </section>

      {/* 12-month history */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Profit History (12 months)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {historyRows.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-sm text-neutral-400">
                    No history yet.
                  </td>
                </tr>
              )}
              {[...historyRows].reverse().map((r) => (
                <tr key={r.month.toISOString()} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {formatMonth(r.month)}
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
    </div>
  );
}
