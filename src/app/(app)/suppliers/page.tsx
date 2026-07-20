import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatPKR } from "@/lib/format";
import { paginate } from "@/lib/pagination";
import { EditDialog } from "@/components/edit-dialog";
import { Pagination } from "@/components/pagination";
import {
  FilterSearch,
  FilterSelect,
  ResetFilters,
} from "@/components/table-filters";
import { CreateSupplierForm, EditSupplierForm } from "./supplier-forms";
import { DeleteSupplierButton } from "./delete-supplier-button";

type SupplierSummaryRow = {
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

const BALANCE_OPTIONS = [
  { value: "owe", label: "We owe them" },
  { value: "clear", label: "Clear" },
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
    sp.balance === "owe" || sp.balance === "clear" ? sp.balance : null;
  const sort = sp.sort === "balance" ? "balance" : "name";
  const hasFilters = Boolean(query || balance);

  const [summaryRows, suppliers] = await Promise.all([
    prisma.$queryRaw<SupplierSummaryRow[]>`
      SELECT * FROM v_supplier_summary ORDER BY name ASC
    `,
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Build a lookup from summary for balance figures
  const summaryById = new Map(
    summaryRows.map((r) => [r.supplier_id, Number(r.balance_owed)])
  );

  const list = suppliers.map((v) => ({
    supplier: v,
    balanceOwed: summaryById.get(v.id) ?? 0,
  }));

  const filtered = list.filter(({ supplier: v, balanceOwed }) => {
    if (
      query &&
      !(
        v.name.toLowerCase().includes(query) ||
        v.phone?.toLowerCase().includes(query)
      )
    )
      return false;
    if (balance === "owe" && !(balanceOwed > 0.005)) return false;
    if (balance === "clear" && balanceOwed > 0.005) return false;
    return true;
  });

  if (sort === "balance") {
    filtered.sort((a, b) => b.balanceOwed - a.balanceOwed);
  }

  const { page, pageCount, total, pageRows } = paginate(filtered, sp.page);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Suppliers
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Manage supplier records.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Add Supplier
        </h2>
        <CreateSupplierForm />
      </section>

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
                <th className="px-4 py-3 text-right font-medium">Balance Owed</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    {hasFilters
                      ? "No suppliers match the current filters."
                      : "No suppliers yet."}
                  </td>
                </tr>
              )}
              {pageRows.map(({ supplier: v, balanceOwed }) => (
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
                  <td className="px-4 py-3 text-right">
                    {balanceOwed > 0 ? (
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        {formatPKR(balanceOwed)}
                      </span>
                    ) : (
                      <span className="text-neutral-400">{formatPKR(balanceOwed)}</span>
                    )}
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
          </table>
        </div>
        <Suspense>
          <Pagination page={page} pageCount={pageCount} total={total} noun="suppliers" />
        </Suspense>
      </section>
    </div>
  );
}
