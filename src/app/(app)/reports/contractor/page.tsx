import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  currentMonthParam,
  formatDate,
  formatMonth,
  formatPKR,
  monthRange,
} from "@/lib/format";
import { MonthPicker } from "@/components/month-picker";
import { ContractorMonthlyChart } from "@/components/charts/contractor-monthly-chart";

type LedgerRow = {
  date: Date;
  entry_type: string;
  description: string;
  amount: string | number;
  balance: string | number;
};
type MonthlyRow = { month: Date; earned: string | number; paid: string | number };

export default async function ContractorReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.month ?? currentMonthParam();
  const { gte, lte } = monthRange(month);

  // Full ledger (ordered exactly like the view's running-balance window).
  const ledger = await prisma.$queryRaw<LedgerRow[]>`
    SELECT date, entry_type, description, amount, balance
    FROM v_contractor_ledger
    ORDER BY date, entry_type, description
  `;

  const rows = ledger.map((r) => ({
    date: new Date(r.date),
    type: r.entry_type,
    description: r.description,
    amount: Number(r.amount),
    balance: Number(r.balance),
  }));

  // Current total balance = last row in window order.
  const currentBalance = rows.length ? rows[rows.length - 1].balance : 0;

  // Rows within the selected month, and the opening balance (last balance before the month).
  const monthRows = rows.filter((r) => r.date >= gte && r.date <= lte);
  const before = rows.filter((r) => r.date < gte);
  const openingBalance = before.length ? before[before.length - 1].balance : 0;

  // Monthly earned vs paid, last 12 months.
  const monthly = await prisma.$queryRaw<MonthlyRow[]>`
    WITH e AS (
      SELECT date_trunc('month', date)::date AS month, SUM(amount) AS earned
      FROM v_contractor_ledger WHERE entry_type = 'EARNED' GROUP BY 1
    ),
    p AS (
      SELECT date_trunc('month', date)::date AS month, SUM(-amount) AS paid
      FROM v_contractor_ledger WHERE entry_type = 'PAYMENT' GROUP BY 1
    )
    SELECT COALESCE(e.month, p.month) AS month,
           COALESCE(e.earned, 0) AS earned,
           COALESCE(p.paid, 0) AS paid
    FROM e FULL OUTER JOIN p ON e.month = p.month
    ORDER BY month DESC LIMIT 12
  `;

  const chartData = monthly
    .map((r) => ({
      month: new Date(r.month),
      earned: Number(r.earned),
      paid: Number(r.paid),
    }))
    .sort((a, b) => a.month.getTime() - b.month.getTime())
    .map((r) => ({
      label: r.month.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      earned: r.earned,
      paid: r.paid,
    }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Contractor Ledger (Thekadar)
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">{formatMonth(month)}</p>
        </div>
        <Suspense>
          <MonthPicker value={month} />
        </Suspense>
      </div>

      {/* Current total balance banner */}
      <div
        className={`rounded-xl border p-4 ${
          currentBalance >= 0
            ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
            : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Current Balance (all time)
        </p>
        <p
          className={`mt-1 text-2xl font-bold ${
            currentBalance >= 0
              ? "text-amber-800 dark:text-amber-400"
              : "text-green-700 dark:text-green-400"
          }`}
        >
          {formatPKR(Math.abs(currentBalance))}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {currentBalance >= 0 ? "Owed to contractor" : "Contractor owes this amount"}
        </p>
      </div>

      {/* Monthly ledger table */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Ledger — {formatMonth(month)}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {/* Opening balance line */}
              <tr className="bg-neutral-50 dark:bg-neutral-800/40">
                <td className="px-4 py-2.5 text-neutral-500" colSpan={3}>
                  Opening balance (before {formatMonth(month)})
                </td>
                <td className="px-4 py-2.5 text-right text-neutral-400">—</td>
                <td className="px-4 py-2.5 text-right font-semibold text-neutral-700 dark:text-neutral-300">
                  {formatPKR(openingBalance)}
                </td>
              </tr>
              {monthRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-400">
                    No ledger entries this month.
                  </td>
                </tr>
              )}
              {monthRows.map((r, i) => (
                <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-4 py-2.5">
                    <TypeBadge type={r.type} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-500">{r.description}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-medium ${
                      r.amount >= 0 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400"
                    }`}
                  >
                    {r.amount >= 0 ? "+" : ""}
                    {formatPKR(r.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(r.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Earned vs paid chart */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Earned vs Paid (monthly)
        </h2>
        {chartData.length > 0 ? (
          <ContractorMonthlyChart data={chartData} />
        ) : (
          <p className="py-8 text-center text-sm text-neutral-400">No history yet.</p>
        )}
      </section>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    EARNED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
    PAYMENT: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
    ADJUSTMENT: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        styles[type] ?? styles.ADJUSTMENT
      }`}
    >
      {type}
    </span>
  );
}
