import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatPKR } from "@/lib/format";
import { EditDialog } from "@/components/edit-dialog";
import { CreateSupplierForm, EditSupplierForm } from "./supplier-forms";

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

export default async function SuppliersPage() {
  await requireAdmin();

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
              {suppliers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    No suppliers yet.
                  </td>
                </tr>
              )}
              {suppliers.map((v) => {
                const balanceOwed = summaryById.get(v.id) ?? 0;
                return (
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
