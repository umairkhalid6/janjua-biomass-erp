import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  currentMonthParam,
  formatDate,
  formatMonth,
  formatPKR,
  monthRange,
  toDateInputValue,
} from "@/lib/format";
import { MonthPicker } from "@/components/month-picker";
import { PaymentForm, AdjustmentForm } from "./contractor-forms";

type LedgerRow = {
  date: Date;
  entry_type: string;
  description: string;
  amount: string | number;
  balance: string | number;
};

export default async function ContractorPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.month ?? currentMonthParam();
  const { gte, lte } = monthRange(month);

  // Current balance = last row of the running-balance view (same ordering
  // as the view's window function: date, entry_type, description).
  const ledgerRows = await prisma.$queryRaw<LedgerRow[]>`
    SELECT * FROM v_contractor_ledger ORDER BY date, entry_type, description
  `;

  const currentBalance =
    ledgerRows.length > 0
      ? Number(ledgerRows[ledgerRows.length - 1].balance)
      : 0;

  const [payments, adjustments] = await Promise.all([
    prisma.contractorPayment.findMany({
      where: { date: { gte, lte } },
      orderBy: { date: "asc" },
    }),
    prisma.contractorAdjustment.findMany({
      where: { date: { gte, lte } },
      orderBy: { date: "asc" },
    }),
  ]);

  const paymentRows = payments.map((p) => ({
    id: p.id,
    date: toDateInputValue(p.date),
    amount: p.amount.toNumber(),
    notes: p.notes,
  }));

  const adjustmentRows = adjustments.map((a) => ({
    id: a.id,
    date: toDateInputValue(a.date),
    amount: a.amount.toNumber(),
    reason: a.reason,
  }));

  const totalPayments = paymentRows.reduce((s, r) => s + r.amount, 0);
  const totalAdjustments = adjustmentRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Contractor (Thekadar)
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {formatMonth(month)}
          </p>
        </div>
        <Suspense>
          <MonthPicker value={month} />
        </Suspense>
      </div>

      {/* Current balance */}
      <div
        className={`rounded-xl border p-4 ${
          currentBalance >= 0
            ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
            : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Current Balance (all time)
        </p>
        <p
          className={`mt-1 text-2xl font-bold ${
            currentBalance >= 0
              ? "text-amber-800 dark:text-amber-400"
              : "text-red-700 dark:text-red-400"
          }`}
        >
          {formatPKR(Math.abs(currentBalance))}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {currentBalance >= 0
            ? "Owed to contractor"
            : "Contractor owes this amount"}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Payment form */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Record Payment
          </h2>
          <PaymentForm />
        </section>

        {/* Adjustment form */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Record Adjustment
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            Correction, opening balance, or cash movement.{" "}
            <span className="font-medium">Paying</span> the contractor raises
            what he owes us; <span className="font-medium">receiving</span> from
            him lowers it.
          </p>
          <AdjustmentForm />
        </section>
      </div>

      {/* Payments table */}
      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Payments — {formatMonth(month)}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {paymentRows.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-sm text-neutral-400"
                  >
                    No payments this month.
                  </td>
                </tr>
              )}
              {paymentRows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {r.notes ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
            {paymentRows.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-50">
                    Total Paid
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {formatPKR(totalPayments)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Adjustments table */}
      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Adjustments — {formatMonth(month)}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {adjustmentRows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-neutral-400"
                  >
                    No adjustments this month.
                  </td>
                </tr>
              )}
              {adjustmentRows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.amount < 0
                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                          : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                      }`}
                    >
                      {r.amount < 0 ? "Paying" : "Receiving"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(Math.abs(r.amount))}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {r.reason}
                  </td>
                </tr>
              ))}
            </tbody>
            {adjustmentRows.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-neutral-900 dark:text-neutral-50"
                  >
                    Net Adjustments
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totalAdjustments >= 0 ? "+" : ""}
                    {formatPKR(totalAdjustments)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
