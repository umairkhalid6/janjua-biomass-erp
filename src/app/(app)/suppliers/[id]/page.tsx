import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatDate, formatPKR, toDateInputValue } from "@/lib/format";
import { EPSILON } from "@/lib/money";
import { BalanceBadge } from "@/components/balance-badge";
import { DeleteButton } from "@/components/delete-button";
import { foldInstantPayments } from "@/lib/ledger";
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
  await requireAdmin();
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  const [summaryRows, ledgerRows, purchases] = await Promise.all([
    prisma.$queryRaw<SummaryRow[]>`
      SELECT * FROM v_supplier_summary WHERE supplier_id = ${id}
    `,
    prisma.$queryRaw<LedgerRow[]>`
      SELECT * FROM v_supplier_ledger
      WHERE supplier_id = ${id}
      ORDER BY date NULLS FIRST, entry_id
    `,
    prisma.materialPurchase.findMany({
      where: { supplierId: id },
      include: { payments: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const summary = summaryRows[0];
  const balanceOwed = summary ? Number(summary.balance_owed) : 0;
  const totalPurchased = summary ? Number(summary.total_purchased) : 0;
  const totalPaid = summary ? Number(summary.total_paid) : 0;
  // Shown as its own card when non-zero, otherwise the other three figures
  // look like they don't add up: opening + purchased − paid = balance.
  const openingBalance = summary ? Number(summary.opening_balance) : 0;
  const hasOpening = Math.abs(openingBalance) > EPSILON;

  // A payment recorded together with its purchase (linked, same date) reads as
  // one event to the owner — fold it into the purchase row instead of showing
  // two ledger lines. Payments applied on a later date stay separate.
  const paymentMethodById = new Map<string, string>();
  const instantPaymentTarget = new Map<string, string>();
  for (const p of purchases) {
    for (const pay of p.payments) {
      paymentMethodById.set(pay.id, pay.method);
      if (pay.date.getTime() === p.date.getTime()) {
        instantPaymentTarget.set(pay.id, p.id);
      }
    }
  }

  const ledger = foldInstantPayments(
    ledgerRows.map((r) => ({
      entryId: r.entry_id,
      date: r.date,
      entryType: r.entry_type,
      description: r.description,
      debit: Number(r.debit),
      credit: Number(r.credit),
      balance: Number(r.balance),
    })),
    instantPaymentTarget
  );

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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
              {supplier.name}
            </h1>
            <BalanceBadge balance={balanceOwed} />
          </div>
          {supplier.phone && (
            <p className="text-sm text-neutral-500">{supplier.phone}</p>
          )}
          {supplier.notes && (
            <p className="text-sm text-neutral-500">{supplier.notes}</p>
          )}
        </div>
      </div>

      {/* Summary cards — opening + purchased − paid = balance */}
      <div
        className={`grid gap-4 ${
          hasOpening ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <div
          className={`rounded-xl border p-4 ${
            balanceOwed > EPSILON
              ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
              : balanceOwed < -EPSILON
              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
              : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {balanceOwed < -EPSILON ? "Advance" : "Balance Owed"}
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              balanceOwed > EPSILON
                ? "text-amber-800 dark:text-amber-400"
                : balanceOwed < -EPSILON
                ? "text-green-700 dark:text-green-400"
                : "text-neutral-900 dark:text-neutral-50"
            }`}
          >
            {formatPKR(Math.abs(balanceOwed))}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {balanceOwed > EPSILON
              ? "We owe this supplier"
              : balanceOwed < -EPSILON
              ? "Advance held by supplier"
              : "Fully settled"}
          </p>
        </div>

        {hasOpening && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Opening Balance
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${
                openingBalance < 0
                  ? "text-green-700 dark:text-green-400"
                  : "text-amber-800 dark:text-amber-400"
              }`}
            >
              {formatPKR(Math.abs(openingBalance))}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {openingBalance < 0
                ? "Advance carried in"
                : "Already owed when added"}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total Purchased
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {formatPKR(totalPurchased)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Material cost (payable) — all time
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total Paid
          </p>
          <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">
            {formatPKR(totalPaid)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {hasOpening
              ? "Payments made — excludes opening"
              : "Payments made"}
          </p>
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
                <th className="px-4 py-3 text-right font-medium">Purchased</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
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
                // Standalone payment rows delete via their own entry id;
                // folded rows delete the payment(s) merged into them.
                const deletablePaymentIds = isPayment
                  ? [row.entryId]
                  : row.foldedPaymentIds;

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
                      {/* Records only that money changed hands when this
                          purchase was entered — never whether the purchase is
                          settled. Settlement is FIFO across the whole account
                          (v_purchase_settlement drives the Purchases badge), so
                          judging it from this row's own payment would
                          contradict it. */}
                      {row.foldedPaymentIds.length > 0 && (
                        <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          Paid at entry —{" "}
                          {row.foldedPaymentIds
                            .map((pid) => paymentMethodById.get(pid) ?? "Cash")
                            .join(", ")}
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
                        ? " Advance"
                        : row.balance > 0
                        ? " Owed"
                        : ""}
                    </td>
                    <td className="px-4 py-3">
                      {/* entry_id for PAYMENT rows is the SupplierPayment.id */}
                      {deletablePaymentIds.map((pid) => (
                        <form key={pid} action={deleteSupplierPayment}>
                          <input type="hidden" name="id" value={pid} />
                          <input type="hidden" name="supplierId" value={id} />
                          <DeleteButton
                            confirmMessage={
                              isPayment
                                ? "Delete this payment? This cannot be undone."
                                : "Delete the payment made with this purchase? The purchase stays and will show as owed."
                            }
                          />
                        </form>
                      ))}
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
