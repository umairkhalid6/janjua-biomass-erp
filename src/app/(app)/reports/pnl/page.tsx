import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  currentMonthParam,
  formatMonth,
  formatPKR,
  parseMonthParam,
} from "@/lib/format";
import { MonthPicker } from "@/components/month-picker";
import { ProfitBarChart } from "@/components/charts/profit-bar-chart";

type SummaryRow = {
  month: Date;
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
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.month ?? currentMonthParam();
  const monthDate = parseMonthParam(month);

  const [current, history] = await Promise.all([
    prisma.$queryRaw<SummaryRow[]>`
      SELECT * FROM v_monthly_summary WHERE month = ${monthDate}::date
    `,
    prisma.$queryRaw<SummaryRow[]>`
      SELECT month, profit FROM v_monthly_summary ORDER BY month DESC LIMIT 12
    `,
  ]);

  const s = current[0];
  const n = (v: string | number | undefined) => Number(v ?? 0);
  const sales = n(s?.sales_revenue);
  const loadingCharges = n(s?.loading_charges);
  const profit = n(s?.profit);

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
          <p className="mt-0.5 text-sm text-neutral-500">{formatMonth(month)}</p>
        </div>
        <Suspense>
          <MonthPicker value={month} />
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
        {!s && (
          <p className="px-4 py-6 text-center text-sm text-neutral-400">
            No data for {formatMonth(month)}.
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
