import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  formatPKR,
  parsePeriodParam,
  periodLabel,
  periodRange,
} from "@/lib/format";
import { MATERIAL_LABELS } from "@/lib/constants";
import { PeriodPicker } from "@/components/period-picker";
import {
  MaterialStackedChart,
  type MaterialStackedDatum,
} from "@/components/charts/material-stacked-chart";

type MaterialRow = {
  month: Date;
  material_type: string;
  weight_kg: string | number;
  total_cost: string | number;
  avg_rate_per_kg: string | number;
};

export default async function MaterialsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const period = parsePeriodParam(sp.period);
  const { gte, lte } = periodRange(period);

  const [current, sixMonth] = await Promise.all([
    // Per-material totals summed across the selected window.
    prisma.$queryRaw<MaterialRow[]>`
      SELECT
        material_type,
        SUM(weight_kg)   AS weight_kg,
        SUM(total_cost)  AS total_cost,
        CASE WHEN SUM(weight_kg) > 0
             THEN ROUND(SUM(total_cost) / SUM(weight_kg), 2)
             ELSE 0 END  AS avg_rate_per_kg
      FROM v_material_totals
      WHERE month >= ${gte}::date AND month <= ${lte}::date
      GROUP BY material_type
    `,
    // Trend chart is always the trailing 6 months, independent of the window.
    prisma.$queryRaw<MaterialRow[]>`
      SELECT month, material_type, total_cost FROM v_material_totals
      WHERE month >= (date_trunc('month', now()) - interval '5 months')::date
      ORDER BY month ASC
    `,
  ]);

  const cards = current
    .map((r) => ({
      type: r.material_type,
      label: MATERIAL_LABELS[r.material_type] ?? r.material_type,
      weight: Number(r.weight_kg),
      cost: Number(r.total_cost),
      rate: Number(r.avg_rate_per_kg),
    }))
    .sort((a, b) => b.cost - a.cost);

  const totalWeight = cards.reduce((s, c) => s + c.weight, 0);
  const totalCost = cards.reduce((s, c) => s + c.cost, 0);

  // Build stacked chart: one series per material type present in the 6-month window.
  const typesPresent = Array.from(new Set(sixMonth.map((r) => r.material_type)));
  const series = typesPresent.map((t) => ({
    key: t,
    label: MATERIAL_LABELS[t] ?? t,
  }));

  const byMonth = new Map<string, MaterialStackedDatum>();
  for (const r of sixMonth) {
    const d = new Date(r.month);
    const key = d.toISOString().slice(0, 7);
    if (!byMonth.has(key)) {
      const base: MaterialStackedDatum = {
        label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      };
      for (const t of typesPresent) base[t] = 0;
      byMonth.set(key, base);
    }
    byMonth.get(key)![r.material_type] = Number(r.total_cost);
  }
  const chartData = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Materials</h1>
          <p className="mt-0.5 text-sm text-neutral-500">{periodLabel(period)}</p>
        </div>
        <Suspense>
          <PeriodPicker value={period} />
        </Suspense>
      </div>

      {/* Per-material cards */}
      {cards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.type}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{c.label}</p>
              <p className="mt-2 text-lg font-bold text-amber-700 dark:text-amber-400">
                {formatPKR(c.cost)}
              </p>
              <dl className="mt-2 space-y-0.5 text-xs text-neutral-500">
                <div className="flex justify-between">
                  <dt>Weight</dt>
                  <dd className="font-medium text-neutral-700 dark:text-neutral-300">
                    {c.weight.toLocaleString()} kg
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Avg rate/kg</dt>
                  <dd className="font-medium text-neutral-700 dark:text-neutral-300">
                    {formatPKR(c.rate)}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
          No material purchases in {periodLabel(period).toLowerCase()}.
        </div>
      )}

      {/* Month totals table */}
      {cards.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Material</th>
                  <th className="px-4 py-3 text-right font-medium">Weight (kg)</th>
                  <th className="px-4 py-3 text-right font-medium">Avg Rate/kg</th>
                  <th className="px-4 py-3 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {cards.map((c) => (
                  <tr key={c.type} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">{c.label}</td>
                    <td className="px-4 py-2.5 text-right text-neutral-500">
                      {c.weight.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-neutral-500">{formatPKR(c.rate)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                      {formatPKR(c.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-50">Total</td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totalWeight.toLocaleString()}
                  </td>
                  <td />
                  <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">
                    {formatPKR(totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* 6-month stacked chart */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Material Cost (6 months)
        </h2>
        {chartData.length > 0 ? (
          <MaterialStackedChart data={chartData} series={series} />
        ) : (
          <p className="py-8 text-center text-sm text-neutral-400">No history yet.</p>
        )}
      </section>
    </div>
  );
}
