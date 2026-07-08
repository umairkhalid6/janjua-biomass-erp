import { Suspense } from "react";
import Link from "next/link";
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
import { MonthPicker } from "@/components/month-picker";
import { DeleteButton } from "@/components/delete-button";
import { EditDialog } from "@/components/edit-dialog";
import { CreateSaleForm, EditSaleForm } from "./sale-forms";
import { deleteSale } from "./actions";
import { auth } from "@/auth";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const month = sp.month ?? currentMonthParam();
  const { gte, lte } = monthRange(month);
  const isAdmin = session.role === "ADMIN";

  // Operators may ADD sales but must not see any sales history/totals. Skip the
  // sales query entirely for them (defence in depth — the table is hidden below
  // regardless, but this avoids leaking past sales data into the RSC payload).
  const [sales, customers] = await Promise.all([
    isAdmin
      ? prisma.pelletSale.findMany({
          where: { date: { gte, lte } },
          include: { customer: true },
          orderBy: { date: "asc" },
        })
      : Promise.resolve([]),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows = sales.map((s) => ({
    id: s.id,
    invoiceNo: s.invoiceNo,
    date: toDateInputValue(s.date),
    customerId: s.customerId,
    customerName: s.customer.name,
    customerCompany: s.customer.company,
    customerPhone: s.customer.phone,
    quantityBags: s.quantityBags.toNumber(),
    ratePerBag: s.ratePerBag.toNumber(),
    amount: s.quantityBags.toNumber() * s.ratePerBag.toNumber(),
    notes: s.notes,
  }));

  const customerOptions = customers.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
  }));

  const totalBags = rows.reduce((s, r) => s + r.quantityBags, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Sales
          </h1>
          {isAdmin && (
            <p className="mt-0.5 text-sm text-neutral-500">
              {formatMonth(month)}
            </p>
          )}
        </div>
        {isAdmin && (
          <Suspense>
            <MonthPicker value={month} />
          </Suspense>
        )}
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Record Sale
        </h2>
        <CreateSaleForm customers={customerOptions} />
      </section>

      {isAdmin && (
      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium text-right">Bags</th>
                <th className="px-4 py-3 font-medium text-right">Rate/bag</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    No sales for {formatMonth(month)}.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-400">
                    <Link
                      href={`/sales/${row.id}/invoice`}
                      className="text-green-700 underline dark:text-green-400"
                    >
                      INV-{String(row.invoiceNo).padStart(5, "0")}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {row.customerName}
                    {row.customerCompany && (
                      <span className="block text-xs text-neutral-400">
                        {row.customerCompany}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {row.quantityBags.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {formatPKR(row.ratePerBag)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <EditDialog title="Edit Sale">
                        <EditSaleForm
                          existing={{
                            id: row.id,
                            date: row.date,
                            customerId: row.customerId,
                            quantityBags: row.quantityBags,
                            ratePerBag: row.ratePerBag,
                            notes: row.notes,
                          }}
                          customers={customerOptions}
                        />
                      </EditDialog>
                      {isAdmin && (
                        <form action={deleteSale}>
                          <input type="hidden" name="id" value={row.id} />
                          <DeleteButton confirmMessage="Delete this sale?" />
                        </form>
                      )}
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
                    {totalBags.toFixed(2)} bags
                  </td>
                  <td />
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {formatPKR(totalAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      )}
    </div>
  );
}
