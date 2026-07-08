import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatDate, formatPKR, parseDateInput, toDateInputValue } from "@/lib/format";
import { PrintButton } from "./print-button";

type LedgerRow = {
  customer_id: string;
  entry_id: string;
  date: Date | null;
  entry_type: string;
  description: string;
  debit: string | number;
  credit: string | number;
  amount: string | number;
  balance: string | number;
};

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const fromDate = sp.from ? parseDateInput(sp.from) : null;
  const toDate = sp.to ? parseDateInput(sp.to) : null;

  // Fetch all ledger rows; filter by date range on the server side
  const allRows = await prisma.$queryRaw<LedgerRow[]>`
    SELECT * FROM v_customer_ledger
    WHERE customer_id = ${id}
    ORDER BY date NULLS FIRST, entry_id
  `;

  // Find the opening balance (balance just before the from date, or the first row if no range)
  let openingCarryBalance = 0;
  let filteredRows: typeof allRows = allRows;

  if (fromDate) {
    // Carry forward: find the balance from the last row BEFORE the from date
    const priorRows = allRows.filter((r) => {
      if (!r.date) return true; // OPENING row is always "before"
      const d = new Date(r.date);
      return d < fromDate;
    });
    if (priorRows.length > 0) {
      openingCarryBalance = Number(priorRows[priorRows.length - 1].balance);
    }
    // Now filter to only rows within the date range
    filteredRows = allRows.filter((r) => {
      if (!r.date) return false; // exclude OPENING row if we have a from date
      const d = new Date(r.date);
      if (d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  } else if (toDate) {
    filteredRows = allRows.filter((r) => {
      if (!r.date) return true; // include OPENING
      const d = new Date(r.date);
      return d <= toDate;
    });
  }

  const printDate = new Date().toLocaleDateString("en-GB");

  const fromLabel = sp.from ? formatDate(sp.from) : "All time";
  const toLabel = sp.to ? formatDate(sp.to) : "present";
  const periodLabel = sp.from || sp.to ? `${fromLabel} – ${toLabel}` : "All time";

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Screen-only controls bar */}
      <div className="print:hidden flex items-center gap-4 border-b border-neutral-200 px-6 py-3 bg-neutral-50">
        <Link
          href={`/customers/${id}`}
          className="text-sm text-neutral-600 underline hover:text-neutral-900"
        >
          ← Back to Customer
        </Link>

        {/* Date range filters */}
        <form method="get" className="flex items-center gap-2">
          <label className="text-xs text-neutral-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="rounded border border-neutral-300 px-2 py-1 text-xs"
          />
          <label className="text-xs text-neutral-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="rounded border border-neutral-300 px-2 py-1 text-xs"
          />
          <button
            type="submit"
            className="rounded bg-neutral-200 px-3 py-1 text-xs font-medium hover:bg-neutral-300"
          >
            Filter
          </button>
          {(sp.from || sp.to) && (
            <Link
              href={`/customers/${id}/statement`}
              className="text-xs text-neutral-500 underline"
            >
              Clear
            </Link>
          )}
        </form>

        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      {/* Statement body */}
      <div className="mx-auto max-w-2xl px-8 py-10">
        {/* Company header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              Janjua Biomass Pellets
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Biomass Pellet Manufacturer
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-700">Account Statement</p>
            <p className="mt-1 text-xs text-neutral-500">Printed: {printDate}</p>
          </div>
        </div>

        <hr className="mb-6 border-neutral-200" />

        {/* Customer info */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Account
            </p>
            <p className="text-base font-semibold text-neutral-900">
              {customer.name}
            </p>
            {customer.company && (
              <p className="text-sm text-neutral-600">{customer.company}</p>
            )}
            {customer.phone && (
              <p className="text-sm text-neutral-600">{customer.phone}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-400">Period</p>
            <p className="text-sm font-medium text-neutral-700">{periodLabel}</p>
          </div>
        </div>

        {/* Opening carry-forward (when a date range is selected) */}
        {fromDate && (
          <div className="mb-2 flex justify-between rounded-lg bg-neutral-50 px-4 py-2 text-sm">
            <span className="text-neutral-500">Opening Balance (brought forward)</span>
            <span
              className={`font-semibold ${
                openingCarryBalance > 0
                  ? "text-amber-700"
                  : openingCarryBalance < 0
                  ? "text-green-700"
                  : "text-neutral-500"
              }`}
            >
              {formatPKR(Math.abs(openingCarryBalance))}
              {openingCarryBalance > 0 ? " Dr" : openingCarryBalance < 0 ? " Cr" : ""}
            </span>
          </div>
        )}

        {/* Ledger table */}
        <table className="mb-8 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="py-2 text-left font-semibold text-neutral-700">Date</th>
              <th className="py-2 text-left font-semibold text-neutral-700">Description</th>
              <th className="py-2 text-right font-semibold text-neutral-700">Debit</th>
              <th className="py-2 text-right font-semibold text-neutral-700">Credit</th>
              <th className="py-2 text-right font-semibold text-neutral-700">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-neutral-400">
                  No transactions in this period.
                </td>
              </tr>
            )}
            {filteredRows.map((row, i) => {
              const debit = Number(row.debit);
              const credit = Number(row.credit);
              const balance = Number(row.balance);
              return (
                <tr key={`${row.entry_id}-${i}`} className="border-b border-neutral-100">
                  <td className="py-2.5 text-neutral-500 whitespace-nowrap">
                    {row.date ? formatDate(toDateInputValue(new Date(row.date))) : "—"}
                  </td>
                  <td className="py-2.5 text-neutral-700 pr-4">{row.description}</td>
                  <td className="py-2.5 text-right text-neutral-900">
                    {debit > 0 ? formatPKR(debit) : ""}
                  </td>
                  <td className="py-2.5 text-right text-green-700">
                    {credit > 0 ? formatPKR(credit) : ""}
                  </td>
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      balance > 0
                        ? "text-amber-700"
                        : balance < 0
                        ? "text-green-700"
                        : "text-neutral-500"
                    }`}
                  >
                    {formatPKR(Math.abs(balance))}
                    {balance > 0 ? " Dr" : balance < 0 ? " Cr" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Closing balance */}
        {filteredRows.length > 0 && (
          <div className="flex justify-end">
            <div className="w-64">
              <div className="flex justify-between border-t-2 border-neutral-900 pt-2">
                <span className="font-bold text-neutral-900">Closing Balance</span>
                <span className="font-bold text-neutral-900">
                  {(() => {
                    const lastBal = Number(filteredRows[filteredRows.length - 1].balance);
                    return `${formatPKR(Math.abs(lastBal))}${lastBal > 0 ? " Dr" : lastBal < 0 ? " Cr" : ""}`;
                  })()}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 text-center text-xs text-neutral-400">
          This is a computer-generated statement. No signature required.
        </div>
      </div>
    </div>
  );
}
