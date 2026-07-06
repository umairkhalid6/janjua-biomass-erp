import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { formatDate, formatPKR, toDateInputValue } from "@/lib/format";
import { DeleteButton } from "@/components/delete-button";
import { SupplierPaymentForm } from "../supplier-forms";
import { deleteSupplierPayment } from "../actions";

type LedgerRow = {
  supplier_id: string;
  entry_id: string;
  date: Date | null;
  entry_type: string;
  description: string;
  debit: string | number;
  credit: string | number;
  amount: string | number;
  balance: string | number;
};

type SummaryRow = {
  supplier_id: string;
  name: string;
  phone: string | null;
  opening_balance: string | number;
  total_purchased: string | number;
  last_purchase_date: Date | null;
  total_paid: string | number;
  last_payment_date: Date | null;
  balance_owed: string | number;
};

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  const [summaryRows, ledgerRows] = await Promise.all([
    prisma.$queryRaw<SummaryRow[]>`
      SELECT * FROM v_supplier_summary WHERE supplier_id = ${id}
    `,
    prisma.$queryRaw<LedgerRow[]>`
      SELECT * FROM v_supplier_ledger
      WHERE supplier_id = ${id}
      ORDER BY date NULLS FIRST, entry_id
    `,
  ]);

  const summary = summaryRows[0];
  const balanceOwed = summary ? Number(summary.balance_owed) : 0;
  const totalPurchased = summary ? Number(summary.total_purchased) : 0;
  const totalPaid = summary ? Number(summary.total_paid) : 0;

  const ledger = ledgerRows.map((r) => ({
    entryId: r.entry_id,
    date: r.date,
    entryType: r.entry_type,
    description: r.description,
    debit: Number(r.debit),
    credit: Number(r.credit),
    balance: Number(r.balance),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/suppliers"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Suppliers
          </Link>
          <h1 className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
            {supplier.name}
          </h1>
          {supplier.phone && (
            <p className="text-sm text-neutral-500">{supplier.phone}</p>
          )}
          {supplier.notes && (
            <p className="text-sm text-neutral-500">{supplier.notes}</p>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div
          className={`rounded-xl border p-4 ${
            balanceOwed > 0
              ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
              : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Balance Owed
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              balanceOwed > 0
                ? "text-amber-800 dark:text-amber-400"
                : "text-neutral-900 dark:text-neutral-50"
            }`}
          >
            {formatPKR(balanceOwed)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {balanceOwed > 0 ? "We owe this supplier" : "Fully settled"}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total Purchased
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {formatPKR(totalPurchased)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">All time</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total Paid
          </p>
          <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">
            {formatPKR(totalPaid)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Payments made</p>
        </div>
      </div>

      {/* Record Payment */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Record Payment
        </h2>
        <SupplierPaymentForm supplierId={id} />
      </section>

      {/* Ledger table */}
      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Ledger
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Debit</th>
                <th className="px-4 py-3 text-right font-medium">Credit</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {ledger.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-neutral-400"
                  >
                    No ledger entries.
                  </td>
                </tr>
              )}
              {ledger.map((row, i) => {
                const isPayment = row.entryType === "PAYMENT";

                return (
                  <tr
                    key={`${row.entryId}-${i}`}
                    className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                      row.entryType === "OPENING"
                        ? "bg-neutral-50/50 dark:bg-neutral-800/20"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">
                      {row.date
                        ? formatDate(toDateInputValue(new Date(row.date)))
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      <span
                        className={
                          row.entryType === "OPENING"
                            ? "text-xs font-medium text-neutral-500"
                            : ""
                        }
                      >
                        {row.description}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                      {row.debit > 0 ? formatPKR(row.debit) : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                      {row.credit > 0 ? formatPKR(row.credit) : ""}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        row.balance > 0
                          ? "text-amber-700 dark:text-amber-400"
                          : row.balance < 0
                          ? "text-green-700 dark:text-green-400"
                          : "text-neutral-500"
                      }`}
                    >
                      {formatPKR(Math.abs(row.balance))}
                      {row.balance < 0
                        ? " Cr"
                        : row.balance > 0
                        ? " Dr"
                        : ""}
                    </td>
                    <td className="px-4 py-3">
                      {/* entry_id for PAYMENT rows is the SupplierPayment.id */}
                      {isPayment && (
                        <form action={deleteSupplierPayment}>
                          <input type="hidden" name="id" value={row.entryId} />
                          <input type="hidden" name="supplierId" value={id} />
                          <DeleteButton confirmMessage="Delete this payment? This cannot be undone." />
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
