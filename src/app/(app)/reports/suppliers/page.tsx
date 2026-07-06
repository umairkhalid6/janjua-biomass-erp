import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatPKR } from "@/lib/format";

type SupplierRow = {
  supplier_id: string;
  name: string;
  total_purchased: string | number;
  total_paid: string | number;
  balance_owed: string | number;
};

export default async function SuppliersReportPage() {
  await requireAdmin();

  const ledger = await prisma.$queryRaw<SupplierRow[]>`
    SELECT * FROM v_supplier_summary ORDER BY balance_owed DESC, name ASC
  `;

  const rows = ledger.map((r) => ({
    id: r.supplier_id,
    name: r.name,
    purchased: Number(r.total_purchased),
    paid: Number(r.total_paid),
    owed: Number(r.balance_owed),
  }));

  const totalPurchased = rows.reduce((s, r) => s + r.purchased, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  const totalOwed = rows.reduce((s, r) => s + r.owed, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Suppliers</h1>
        <p className="mt-0.5 text-sm text-neutral-500">Purchases, payments and balance owed (all time).</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 text-right font-medium">Purchased</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
                <th className="px-4 py-3 text-right font-medium">Balance Owed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-400">
                    No suppliers yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-50">
                    {r.name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                    {formatPKR(r.purchased)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-green-700 dark:text-green-400">
                    {formatPKR(r.paid)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold ${
                      r.owed > 0
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-neutral-500"
                    }`}
                  >
                    {formatPKR(r.owed)}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-50">Total</td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {formatPKR(totalPurchased)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {formatPKR(totalPaid)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">
                    {formatPKR(totalOwed)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
