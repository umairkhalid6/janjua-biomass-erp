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
import { MATERIAL_LABELS } from "@/lib/constants";
import { paginate, parseNumberParam } from "@/lib/pagination";
import { MonthPicker } from "@/components/month-picker";
import { DeleteButton } from "@/components/delete-button";
import { EditDialog } from "@/components/edit-dialog";
import { Pagination } from "@/components/pagination";
import {
  FilterRange,
  FilterSearch,
  FilterSelect,
  ResetFilters,
} from "@/components/table-filters";
import { CreatePurchaseForm, EditPurchaseForm } from "./purchase-forms";
import { deletePurchase } from "./actions";
import type { MaterialType } from "@prisma/client";

const MATERIAL_KEYS = Object.keys(MATERIAL_LABELS) as MaterialType[];

type PurchaseSearchParams = {
  month?: string;
  material?: string;
  supplier?: string;
  minRate?: string;
  maxRate?: string;
  q?: string;
  page?: string;
};

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<PurchaseSearchParams>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.month ?? currentMonthParam();
  const material = (sp.material as MaterialType | undefined) ?? null;
  const { gte, lte } = monthRange(month);

  const supplierId = sp.supplier ?? null;
  const minRate = parseNumberParam(sp.minRate);
  const maxRate = parseNumberParam(sp.maxRate);
  const notesQuery = sp.q?.trim().toLowerCase() ?? "";
  const hasFilters = Boolean(
    supplierId || minRate !== null || maxRate !== null || notesQuery
  );

  const [purchases, suppliers] = await Promise.all([
    prisma.materialPurchase.findMany({
      where: {
        date: { gte, lte },
        ...(material ? { materialType: material } : {}),
      },
      include: { supplier: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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

  const filtered = rows.filter(
    (r) =>
      (!supplierId || r.supplierId === supplierId) &&
      (minRate === null || r.ratePerKg >= minRate) &&
      (maxRate === null || r.ratePerKg <= maxRate) &&
      (!notesQuery || (r.notes ?? "").toLowerCase().includes(notesQuery))
  );

  // Totals cover every filtered row, not just the visible page.
  const totalKg = filtered.reduce((s, r) => s + r.weightKg, 0);
  const totalMat = filtered.reduce((s, r) => s + r.materialCost, 0);
  const totalHand = filtered.reduce((s, r) => s + r.handlingCost, 0);
  const totalAll = filtered.reduce((s, r) => s + r.total, 0);
  const avgRate = totalKg > 0 ? totalAll / totalKg : 0;

  const { page, pageCount, total, pageRows } = paginate(filtered, sp.page);

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
          <MaterialFilter current={material} searchParams={sp} />
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
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Suspense>
            <FilterSelect
              paramName="supplier"
              value={supplierId ?? ""}
              options={supplierOptions.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
              allLabel="All suppliers"
            />
            <FilterRange
              minParam="minRate"
              maxParam="maxRate"
              minValue={sp.minRate}
              maxValue={sp.maxRate}
              placeholder={["Min rate/kg", "Max rate/kg"]}
            />
            <FilterSearch
              paramName="q"
              value={sp.q ?? ""}
              placeholder="Search notes"
            />
            {hasFilters && (
              <ResetFilters params={["supplier", "minRate", "maxRate", "q"]} />
            )}
          </Suspense>
        </div>
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
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    {hasFilters
                      ? "No purchases match the current filters."
                      : `No purchases for ${formatMonth(month)}${
                          material ? ` (${MATERIAL_LABELS[material]})` : ""
                        }.`}
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
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
            {filtered.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-neutral-900 dark:text-neutral-50">
                    {hasFilters ? "Filtered Total" : "Month Total"}
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
        <Suspense>
          <Pagination page={page} pageCount={pageCount} total={total} noun="purchases" />
        </Suspense>
      </section>
    </div>
  );
}

function MaterialFilter({
  current,
  searchParams,
}: {
  current: MaterialType | null;
  searchParams: PurchaseSearchParams;
}) {
  // Server component — renders filter links that keep the month and the other
  // filters, but reset pagination.
  const hrefFor = (material: MaterialType | null) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (!v || k === "material" || k === "page") continue;
      params.set(k, v);
    }
    if (material) params.set("material", material);
    const qs = params.toString();
    return qs ? `/purchases?${qs}` : "/purchases";
  };

  const base =
    "rounded-lg border px-3 py-1.5 text-xs font-medium transition";
  const active =
    "border-green-700 bg-green-700 text-white";
  const inactive =
    "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800";

  return (
    <>
      <a href={hrefFor(null)} className={`${base} ${!current ? active : inactive}`}>
        All
      </a>
      {MATERIAL_KEYS.map((k) => (
        <a
          key={k}
          href={hrefFor(k)}
          className={`${base} ${current === k ? active : inactive}`}
        >
          {MATERIAL_LABELS[k]}
        </a>
      ))}
    </>
  );
}
