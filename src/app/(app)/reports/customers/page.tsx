import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  formatDate,
  formatPKR,
  parsePeriodParam,
  periodLabel,
  periodRange,
} from "@/lib/format";
import { PeriodPicker } from "@/components/period-picker";

type CustomerRow = {
  customer_id: string;
  name: string;
  company: string | null;
  sales_count: string | number;
  total_bags: string | number;
  total_sales: string | number;
  total_loading: string | number;
  last_sale_date: Date | null;
};

export default async function CustomersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const period = parsePeriodParam(sp.period);
  const { gte, lte } = periodRange(period);

  // Per-customer sales within the window (gross = net + loading, matching
  // v_customer_summary). INNER JOIN so only customers active in the window show.
  const ledger = await prisma.$queryRaw<CustomerRow[]>`
    SELECT
      c.id                                                              AS customer_id,
      c.name,
      c.company,
      COUNT(s.id)                                                       AS sales_count,
      COALESCE(SUM(s."quantityBags"), 0)                                AS total_bags,
      COALESCE(SUM(s."quantityBags" * (s."ratePerBag" + s."loadingChargePerBag")), 0) AS total_sales,
      COALESCE(SUM(s."quantityBags" * s."loadingChargePerBag"), 0)      AS total_loading,
      MAX(s.date)                                                       AS last_sale_date
    FROM customers c
    JOIN pellet_sales s
      ON s."customerId" = c.id AND s.date >= ${gte}::date AND s.date <= ${lte}::date
    GROUP BY c.id, c.name, c.company
    ORDER BY total_sales DESC, c.name ASC
  `;

  const rows = ledger.map((r) => ({
    id: r.customer_id,
    name: r.name,
    company: r.company,
    salesCount: Number(r.sales_count),
    totalBags: Number(r.total_bags),
    // Gross (invoiced) total; the loading share within it is shown separately.
    totalAmount: Number(r.total_sales),
    totalLoading: Number(r.total_loading),
    lastSale: r.last_sale_date ? new Date(r.last_sale_date) : null,
  }));

  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);
  const grandLoading = rows.reduce((s, r) => s + r.totalLoading, 0);
  const grandBags = rows.reduce((s, r) => s + r.totalBags, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Customers</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Sales per customer — {periodLabel(period).toLowerCase()}.
          </p>
        </div>
        <Suspense>
          <PeriodPicker value={period} />
        </Suspense>
      </div>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 text-right font-medium">Sales</th>
                <th className="px-4 py-3 text-right font-medium">Bags</th>
                <th className="px-4 py-3 text-right font-medium">Loading</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Last Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-neutral-400">
                    No sales in this period.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-neutral-900 dark:text-neutral-50">{r.name}</span>
                    {r.company && (
                      <span className="ml-1 text-xs text-neutral-500">· {r.company}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500">{r.salesCount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                    {r.totalBags.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-500 dark:text-neutral-400">
                    {formatPKR(r.totalLoading)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(r.totalAmount)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-500">
                    {r.lastSale ? formatDate(r.lastSale) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-50">Total</td>
                  <td />
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {grandBags.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400">
                    {formatPKR(grandLoading)}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-700 dark:text-blue-400">
                    {formatPKR(grandTotal)}
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
