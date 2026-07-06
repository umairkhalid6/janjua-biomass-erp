import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { formatDate, formatPKR, toDateInputValue } from "@/lib/format";
import { DeleteButton } from "@/components/delete-button";
import { CustomerPaymentForm } from "../customer-forms";
import { deleteCustomerPayment } from "../actions";

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

type SummaryRow = {
  customer_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  opening_balance: string | number;
  total_sales: string | number;
  sales_count: string | number;
  total_bags: string | number;
  last_sale_date: Date | null;
  total_paid: string | number;
  last_payment_date: Date | null;
  outstanding: string | number;
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const [summaryRows, ledgerRows] = await Promise.all([
    prisma.$queryRaw<SummaryRow[]>`
      SELECT * FROM v_customer_summary WHERE customer_id = ${id}
    `,
    prisma.$queryRaw<LedgerRow[]>`
      SELECT * FROM v_customer_ledger
      WHERE customer_id = ${id}
      ORDER BY date NULLS FIRST, entry_id
    `,
  ]);

  const summary = summaryRows[0];
  const outstanding = summary ? Number(summary.outstanding) : 0;
  const totalSales = summary ? Number(summary.total_sales) : 0;
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
            href="/customers"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Customers
          </Link>
          <h1 className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-50">
            {customer.name}
          </h1>
          {customer.company && (
            <p className="text-sm text-neutral-500">{customer.company}</p>
          )}
          {customer.phone && (
            <p className="text-sm text-neutral-500">{customer.phone}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${id}/statement`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Statement
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div
          className={`rounded-xl border p-4 ${
            outstanding > 0
              ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
              : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Outstanding
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              outstanding > 0
                ? "text-amber-800 dark:text-amber-400"
                : "text-neutral-900 dark:text-neutral-50"
            }`}
          >
            {formatPKR(outstanding)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {outstanding > 0 ? "Amount receivable" : "Fully settled"}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total Sales
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {formatPKR(totalSales)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">All time</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total Received
          </p>
          <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">
            {formatPKR(totalPaid)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Payments collected</p>
        </div>
      </div>

      {/* Record Payment */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Record Payment
        </h2>
        <CustomerPaymentForm customerId={id} />
      </section>

      {/* Ledger table */}
      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Ledger
          </h2>
          <Link
            href={`/customers/${id}/statement`}
            className="text-xs text-green-700 hover:underline dark:text-green-400"
          >
            Print Statement →
          </Link>
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
                const isSale = row.entryType === "SALE";
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
                      {isSale ? (
                        <Link
                          href={`/sales/${row.entryId}/invoice`}
                          className="text-green-700 hover:underline dark:text-green-400"
                        >
                          {row.description}
                        </Link>
                      ) : (
                        <span
                          className={
                            row.entryType === "OPENING"
                              ? "text-xs font-medium text-neutral-500"
                              : ""
                          }
                        >
                          {row.description}
                        </span>
                      )}
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
                      {/* entry_id for PAYMENT rows is the CustomerPayment.id */}
                      {isPayment && (
                        <form action={deleteCustomerPayment}>
                          <input type="hidden" name="id" value={row.entryId} />
                          <input type="hidden" name="customerId" value={id} />
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
