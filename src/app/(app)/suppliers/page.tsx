import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatPKR } from "@/lib/format";
import { EPSILON } from "@/lib/money";
import { paginate } from "@/lib/pagination";
import { BalanceBadge } from "@/components/balance-badge";
import { EditDialog } from "@/components/edit-dialog";
import { Pagination } from "@/components/pagination";
import {
  FilterSearch,
  FilterSelect,
  ResetFilters,
} from "@/components/table-filters";
import { EditSupplierForm } from "./supplier-forms";
import { DeleteSupplierButton } from "./delete-supplier-button";

type SupplierSummaryRow = {
  supplier_id: string;
  name: string;
  phone: string | null;
  opening_balance: string | number;
  opening_owed: string | number;
  opening_advance: string | number;
  total_purchased: string | number;
  total_payable: string | number;
  last_purchase_date: Date | null;
  total_paid: string | number;
  total_paid_all: string | number;
  last_payment_date: Date | null;
  balance_owed: string | number;
};

const BALANCE_OPTIONS = [
  { value: "owe", label: "We owe them" },
  { value: "clear", label: "Clear" },
  { value: "advance", label: "They hold advance" },
];

const SORT_OPTIONS = [
  { value: "balance", label: "Sort: Balance owed (high → low)" },
];

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    balance?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const query = sp.q?.trim().toLowerCase() ?? "";
  const balance =
    sp.balance === "owe" || sp.balance === "clear" || sp.balance === "advance"
      ? sp.balance
      : null;
  const sort = sp.sort === "balance" ? "balance" : "name";
  const hasFilters = Boolean(query || balance);

  const [summaryRows, suppliers] = await Promise.all([
    prisma.$queryRaw<SupplierSummaryRow[]>`
      SELECT * FROM v_supplier_summary ORDER BY name ASC
    `,
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Build a lookup from summary for ledger figures (payables are material
  // cost only; handling cost never enters supplier balances). Payable and paid
  // both include the opening balance on their side of it, matching the
  // supplier detail cards — so payable − paid = balance reads on every row.
  const summaryById = new Map(
    summaryRows.map((r) => [
      r.supplier_id,
      {
        balanceOwed: Number(r.balance_owed),
        totalPayable: Number(r.total_payable),
        totalPaid: Number(r.total_paid_all),
      },
    ])
  );

  const list = suppliers.map((v) => {
    const s = summaryById.get(v.id);
    return {
      supplier: v,
      balanceOwed: s?.balanceOwed ?? 0,
      totalPayable: s?.totalPayable ?? 0,
      totalPaid: s?.totalPaid ?? 0,
    };
  });

  const filtered = list.filter(({ supplier: v, balanceOwed }) => {
    if (
      query &&
      !(
        v.name.toLowerCase().includes(query) ||
        v.phone?.toLowerCase().includes(query)
      )
    )
      return false;
    // Three-way split: a negative balance is an advance we hold with the
    // supplier — not "clear" (mirrors the customers page semantics).
    if (balance === "owe" && !(balanceOwed > EPSILON)) return false;
    if (balance === "clear" && Math.abs(balanceOwed) > EPSILON) return false;
    if (balance === "advance" && !(balanceOwed < -EPSILON)) return false;
    return true;
  });

  if (sort === "balance") {
    filtered.sort((a, b) => b.balanceOwed - a.balanceOwed);
  }

  const { page, pageCount, total, pageRows } = paginate(filtered, sp.page);

  // Totals cover every filtered row, not just the visible page.
  const sumPayable = filtered.reduce((s, r) => s + r.totalPayable, 0);
  const sumPaid = filtered.reduce((s, r) => s + r.totalPaid, 0);
  const sumOwed = filtered.reduce((s, r) => s + r.balanceOwed, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Supplier Ledger
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Click a supplier to see the full ledger or record a payment /
            adjustment. Payable and owed are material cost only; any opening
            balance is counted as payable or as paid, whichever side it sits on.
          </p>
        </div>
        <Link
          href="/suppliers/new"
          className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
        >
          + Add Supplier
        </Link>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Suspense>
            <FilterSearch
              paramName="q"
              value={sp.q ?? ""}
              placeholder="Name, phone"
            />
            <FilterSelect
              paramName="balance"
              value={balance ?? ""}
              options={BALANCE_OPTIONS}
              allLabel="Any balance"
            />
            <FilterSelect
              paramName="sort"
              value={sort === "balance" ? "balance" : ""}
              options={SORT_OPTIONS}
              allLabel="Sort: Name"
            />
            {hasFilters && <ResetFilters params={["q", "balance"]} />}
          </Suspense>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Total Payable</th>
                <th className="px-4 py-3 text-right font-medium">Total Paid</th>
                <th className="px-4 py-3 text-right font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    {hasFilters
                      ? "No suppliers match the current filters."
                      : "No suppliers yet."}
                  </td>
                </tr>
              )}
              {pageRows.map(({ supplier: v, balanceOwed, totalPayable, totalPaid }) => (
                <tr
                  key={v.id}
                  className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    <Link
                      href={`/suppliers/${v.id}`}
                      className="hover:underline text-green-700 dark:text-green-400"
                    >
                      {v.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {v.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {formatPKR(totalPayable)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {formatPKR(totalPaid)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <BalanceBadge balance={balanceOwed} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <EditDialog title="Edit Supplier">
                        <EditSupplierForm
                          existing={{
                            id: v.id,
                            name: v.name,
                            phone: v.phone,
                            notes: v.notes,
                            openingBalance: v.openingBalance.toNumber(),
                          }}
                        />
                      </EditDialog>
                      <DeleteSupplierButton supplierId={v.id} supplierName={v.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-neutral-900 dark:text-neutral-50">
                    {hasFilters ? "Filtered Total" : "Total"}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {formatPKR(sumPayable)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {formatPKR(sumPaid)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">
                    {formatPKR(sumOwed)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Suspense>
          <Pagination page={page} pageCount={pageCount} total={total} noun="suppliers" />
        </Suspense>
      </section>
    </div>
  );
}
