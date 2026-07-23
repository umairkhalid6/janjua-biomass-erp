import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  formatDate,
  formatPKR,
  parsePeriodParam,
  periodLabel,
  periodRange,
  toDateInputValue,
} from "@/lib/format";
import { MATERIAL_LABELS } from "@/lib/constants";
import { PeriodPicker } from "@/components/period-picker";

type TotalsRow = {
  handling: string | number | null;
  material: string | number | null;
  purchases_with_handling: string | number | bigint;
};
type MaterialRow = {
  material_type: string;
  handling: string | number;
  weight_kg: string | number;
  handling_per_kg: string | number | null;
};
type SupplierRow = {
  supplier_id: string;
  name: string;
  handling: string | number;
  purchase_count: string | number | bigint;
};
type MonthRow = {
  month: Date;
  handling: string | number;
};
type RecentRow = {
  id: string;
  date: Date;
  material_type: string;
  supplier_name: string;
  weight_kg: string | number;
  handling: string | number;
  material: string | number;
};

export default async function HandlingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const period = parsePeriodParam(sp.period);
  const { gte, lte } = periodRange(period);

  const [totalsRows, byMaterial, bySupplier, byMonth, recent] =
    await Promise.all([
      prisma.$queryRaw<TotalsRow[]>`
        SELECT SUM("handlingCost") AS handling,
               SUM("materialCost") AS material,
               COUNT(*) FILTER (WHERE "handlingCost" > 0) AS purchases_with_handling
        FROM material_purchases
        WHERE date >= ${gte}::date AND date <= ${lte}::date
      `,
      prisma.$queryRaw<MaterialRow[]>`
        SELECT "materialType" AS material_type,
               SUM("handlingCost") AS handling,
               SUM("weightKg")     AS weight_kg,
               CASE WHEN SUM("weightKg") > 0
                    THEN ROUND(SUM("handlingCost") / SUM("weightKg"), 2)
                    ELSE 0 END     AS handling_per_kg
        FROM material_purchases
        WHERE date >= ${gte}::date AND date <= ${lte}::date
        GROUP BY 1
        HAVING SUM("handlingCost") > 0
        ORDER BY handling DESC
      `,
      prisma.$queryRaw<SupplierRow[]>`
        SELECT s.id   AS supplier_id,
               s.name,
               SUM(mp."handlingCost") AS handling,
               COUNT(*) FILTER (WHERE mp."handlingCost" > 0) AS purchase_count
        FROM material_purchases mp
        JOIN suppliers s ON s.id = mp."supplierId"
        WHERE mp.date >= ${gte}::date AND mp.date <= ${lte}::date
        GROUP BY 1, 2
        HAVING SUM(mp."handlingCost") > 0
        ORDER BY handling DESC
      `,
      // Trailing 6 months, independent of the period window above.
      prisma.$queryRaw<MonthRow[]>`
        SELECT date_trunc('month', date)::date AS month,
               SUM("handlingCost")             AS handling
        FROM material_purchases
        WHERE date >= (date_trunc('month', CURRENT_DATE) - interval '5 months')::date
        GROUP BY 1
        ORDER BY 1 DESC
      `,
      prisma.$queryRaw<RecentRow[]>`
        SELECT mp.id,
               mp.date,
               mp."materialType"   AS material_type,
               s.name              AS supplier_name,
               mp."weightKg"       AS weight_kg,
               mp."handlingCost"   AS handling,
               mp."materialCost"   AS material
        FROM material_purchases mp
        JOIN suppliers s ON s.id = mp."supplierId"
        WHERE mp.date >= ${gte}::date AND mp.date <= ${lte}::date
          AND mp."handlingCost" > 0
        ORDER BY mp.date DESC, mp."createdAt" DESC
        LIMIT 15
      `,
    ]);

  const totals = totalsRows[0];
  const totalHandling = Number(totals?.handling ?? 0);
  const totalMaterial = Number(totals?.material ?? 0);
  const withHandlingCount = Number(totals?.purchases_with_handling ?? 0);
  const handlingShare =
    totalHandling + totalMaterial > 0
      ? (totalHandling / (totalHandling + totalMaterial)) * 100
      : 0;

  const materialRows = byMaterial.map((r) => ({
    type: r.material_type,
    label: MATERIAL_LABELS[r.material_type] ?? r.material_type,
    handling: Number(r.handling),
    weight: Number(r.weight_kg),
    perKg: Number(r.handling_per_kg ?? 0),
  }));
  const supplierRows = bySupplier.map((r) => ({
    id: r.supplier_id,
    name: r.name,
    handling: Number(r.handling),
    count: Number(r.purchase_count),
  }));
  const monthRows = byMonth.map((r) => ({
    month: new Date(r.month),
    handling: Number(r.handling),
  }));
  const recentRows = recent.map((r) => {
    const handling = Number(r.handling);
    const material = Number(r.material);
    const purchaseTotal = handling + material;
    return {
      id: r.id,
      date: toDateInputValue(new Date(r.date)),
      label: MATERIAL_LABELS[r.material_type] ?? r.material_type,
      supplier: r.supplier_name,
      weight: Number(r.weight_kg),
      handling,
      share: purchaseTotal > 0 ? (handling / purchaseTotal) * 100 : 0,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Handling Costs
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Unloading / gari expenses (your own cost, not payable to suppliers)
            — {periodLabel(period).toLowerCase()}
          </p>
        </div>
        <Suspense>
          <PeriodPicker value={period} />
        </Suspense>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total Handling Cost
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400">
            {formatPKR(totalHandling)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {periodLabel(period)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Share of Total Cost
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {handlingShare.toFixed(1)}%
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Handling ÷ (material + handling)
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Purchases with Handling
          </p>
          <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {withHandlingCount}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">In this period</p>
        </div>
      </div>

      {/* By material type */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            By Material
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 text-right font-medium">Weight (kg)</th>
                <th className="px-4 py-3 text-right font-medium">Handling/kg</th>
                <th className="px-4 py-3 text-right font-medium">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {materialRows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-neutral-400"
                  >
                    No handling costs in {periodLabel(period).toLowerCase()}.
                  </td>
                </tr>
              )}
              {materialRows.map((r) => (
                <tr
                  key={r.type}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {r.label}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500">
                    {r.weight.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500">
                    {formatPKR(r.perKg)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(r.handling)}
                  </td>
                </tr>
              ))}
            </tbody>
            {materialRows.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-50">
                    Total
                  </td>
                  <td />
                  <td />
                  <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">
                    {formatPKR(materialRows.reduce((s, r) => s + r.handling, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* By supplier */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            By Supplier
          </h2>
          <p className="text-xs text-neutral-500">
            Where handling cost was incurred — grouped by the supplier whose
            material was handled.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 text-right font-medium">Purchases</th>
                <th className="px-4 py-3 text-right font-medium">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {supplierRows.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-sm text-neutral-400"
                  >
                    No handling costs in {periodLabel(period).toLowerCase()}.
                  </td>
                </tr>
              )}
              {supplierRows.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-50">
                    {r.name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500">
                    {r.count}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(r.handling)}
                  </td>
                </tr>
              ))}
            </tbody>
            {supplierRows.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-50">
                    Total
                  </td>
                  <td />
                  <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">
                    {formatPKR(supplierRows.reduce((s, r) => s + r.handling, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Monthly trend (trailing 6 months) */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Last 6 Months
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 text-right font-medium">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {monthRows.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-6 text-center text-sm text-neutral-400"
                  >
                    No purchases in the last 6 months.
                  </td>
                </tr>
              )}
              {monthRows.map((r) => (
                <tr
                  key={r.month.toISOString()}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {r.month.toLocaleDateString("en-PK", {
                      month: "long",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(r.handling)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent purchases with handling */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Recent Purchases with Handling
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 text-right font-medium">Weight (kg)</th>
                <th className="px-4 py-3 text-right font-medium">Handling</th>
                <th className="px-4 py-3 text-right font-medium">% of Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {recentRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-neutral-400"
                  >
                    No handling costs in {periodLabel(period).toLowerCase()}.
                  </td>
                </tr>
              )}
              {recentRows.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-2.5 text-neutral-500 text-xs whitespace-nowrap">
                    {formatDate(r.date)}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300 text-xs">
                    {r.label}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {r.supplier}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500">
                    {r.weight.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(r.handling)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500">
                    {r.share.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
