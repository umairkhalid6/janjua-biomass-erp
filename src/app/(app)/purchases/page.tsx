import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import {
  currentMonthParam,
  formatDate,
  formatMonth,
  formatPKR,
  monthRange,
  toDateInputValue,
} from "@/lib/format";
import { MATERIAL_LABELS } from "@/lib/constants";
import { MonthPicker } from "@/components/month-picker";
import { DeleteButton } from "@/components/delete-button";
import { EditDialog } from "@/components/edit-dialog";
import { CreatePurchaseForm, EditPurchaseForm } from "./purchase-forms";
import { deletePurchase } from "./actions";
import type { MaterialType } from "@prisma/client";

const MATERIAL_KEYS = Object.keys(MATERIAL_LABELS) as MaterialType[];

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; material?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const month = sp.month ?? currentMonthParam();
  const material = (sp.material as MaterialType | undefined) ?? null;
  const { gte, lte } = monthRange(month);

  const [purchases, suppliers] = await Promise.all([
    prisma.materialPurchase.findMany({
      where: {
        date: { gte, lte },
        ...(material ? { materialType: material } : {}),
      },
      include: { supplier: true },
      orderBy: { date: "asc" },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows = purchases.map((p) => {
    const matCost = p.materialCost.toNumber();
    const handCost = p.handlingCost.toNumber();
    const weightKg = p.weightKg.toNumber();
    const total = matCost + handCost;
    // Prefer the stored rate; fall back to computing for legacy rows.
    const storedRate = p.ratePerKg.toNumber();
    const ratePerKg =
      storedRate > 0 ? storedRate : weightKg > 0 ? total / weightKg : 0;
    return {
      id: p.id,
      date: toDateInputValue(p.date),
      materialType: p.materialType,
      supplierId: p.supplierId,
      supplierName: p.supplier.name,
      weightKg,
      materialCost: matCost,
      handlingCost: handCost,
      total,
      ratePerKg,
      notes: p.notes,
    };
  });

  const totalKg = rows.reduce((s, r) => s + r.weightKg, 0);
  const totalMat = rows.reduce((s, r) => s + r.materialCost, 0);
  const totalHand = rows.reduce((s, r) => s + r.handlingCost, 0);
  const totalAll = rows.reduce((s, r) => s + r.total, 0);
  const avgRate = totalKg > 0 ? totalAll / totalKg : 0;

  const supplierOptions = suppliers.map((v) => ({ id: v.id, name: v.name }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Purchases
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {formatMonth(month)}
          </p>
        </div>
        <Suspense>
          <MonthPicker value={month} />
        </Suspense>
      </div>

      {/* Material filter tabs */}
      <div className="flex flex-wrap gap-2">
        <Suspense>
          <MaterialFilter current={material} />
        </Suspense>
      </div>

      {/* Form */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Record Purchase
        </h2>
        <CreatePurchaseForm suppliers={supplierOptions} />
      </section>

      {/* Table */}
      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium text-right">Weight (kg)</th>
                <th className="px-4 py-3 font-medium text-right">Mat. Cost</th>
                <th className="px-4 py-3 font-medium text-right">Handling</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Rate/kg</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    No purchases for {formatMonth(month)}
                    {material ? ` (${MATERIAL_LABELS[material]})` : ""}.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300 text-xs">
                    {MATERIAL_LABELS[row.materialType]}
                  </td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {row.supplierName}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {row.weightKg.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {formatPKR(row.materialCost)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {formatPKR(row.handlingCost)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(row.total)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500 text-xs">
                    {formatPKR(row.ratePerKg)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <EditDialog title="Edit Purchase">
                        <EditPurchaseForm
                          existing={{
                            id: row.id,
                            date: row.date,
                            materialType: row.materialType,
                            supplierId: row.supplierId,
                            weightKg: row.weightKg,
                            materialCost: row.materialCost,
                            handlingCost: row.handlingCost,
                            notes: row.notes,
                          }}
                          suppliers={supplierOptions}
                        />
                      </EditDialog>
                      <form action={deletePurchase}>
                        <input type="hidden" name="id" value={row.id} />
                        <DeleteButton confirmMessage="Delete this purchase?" />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-neutral-900 dark:text-neutral-50">
                    Month Total
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totalKg.toFixed(2)} kg
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {formatPKR(totalMat)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {formatPKR(totalHand)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {formatPKR(totalAll)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500">
                    {formatPKR(avgRate)}/kg
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

function MaterialFilter({ current }: { current: MaterialType | null }) {
  // Server component — renders filter links
  const base =
    "rounded-lg border px-3 py-1.5 text-xs font-medium transition";
  const active =
    "border-green-700 bg-green-700 text-white";
  const inactive =
    "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800";

  return (
    <>
      <a href="/purchases" className={`${base} ${!current ? active : inactive}`}>
        All
      </a>
      {MATERIAL_KEYS.map((k) => (
        <a
          key={k}
          href={`/purchases?material=${k}`}
          className={`${base} ${current === k ? active : inactive}`}
        >
          {MATERIAL_LABELS[k]}
        </a>
      ))}
    </>
  );
}
