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
import { CreateSaleForm, EditSaleForm } from "./sale-forms";
import { deleteSale } from "./actions";

const STATUS_OPTIONS = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partially paid" },
  { value: "unpaid", label: "Unpaid" },
];

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    customer?: string;
    invoice?: string;
    status?: string;
    min?: string;
    max?: string;
    page?: string;
  }>;
}) {
  const session = await requireUser();
  const sp = await searchParams;
  const month = sp.month ?? currentMonthParam();
  const { gte, lte } = monthRange(month);
  const isAdmin = session.role === "ADMIN";

  const customerId = sp.customer ?? null;
  // Invoice search matches on digits, so "INV-00123", "00123" and "123" all work.
  const invoiceQuery = sp.invoice?.replace(/\D/g, "") ?? "";
  const status =
    sp.status === "paid" || sp.status === "partial" || sp.status === "unpaid"
      ? sp.status
      : null;
  const minAmount = parseNumberParam(sp.min);
  const maxAmount = parseNumberParam(sp.max);
  const hasFilters = Boolean(
    customerId || invoiceQuery || status || minAmount !== null || maxAmount !== null
  );

  // Admins see every sale for the month. Operators see only the sales they
  // entered themselves (scoped by createdById) — never records added by others.
  const [sales, customers] = await Promise.all([
    prisma.pelletSale.findMany({
      where: {
        date: { gte, lte },
        ...(isAdmin ? {} : { createdById: session.id }),
      },
      include: { customer: true, payments: { select: { amount: true } } },
      orderBy: [{ date: "desc" }, { invoiceNo: "desc" }],
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows = sales.map((s) => {
    const quantityBags = s.quantityBags.toNumber();
    const ratePerBag = s.ratePerBag.toNumber(); // net pellet price
    const loadingChargePerBag = s.loadingChargePerBag.toNumber();
    const amount = quantityBags * (ratePerBag + loadingChargePerBag);
    const received = s.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
    return {
      id: s.id,
      invoiceNo: s.invoiceNo,
      date: toDateInputValue(s.date),
      customerId: s.customerId,
      customerName: s.customer.name,
      customerCompany: s.customer.company,
      customerPhone: s.customer.phone,
      quantityBags,
      ratePerBag,
      grossRatePerBag: ratePerBag + loadingChargePerBag,
      loadingAmount: quantityBags * loadingChargePerBag,
      // Invoice total: pellets + loading (what the customer owes).
      amount,
      status:
        amount - received <= 0.005
          ? "paid"
          : received > 0.005
            ? "partial"
            : "unpaid",
      notes: s.notes,
    };
  });

  const filtered = rows.filter(
    (r) =>
      (!customerId || r.customerId === customerId) &&
      (!invoiceQuery || String(r.invoiceNo).includes(invoiceQuery)) &&
      (!status || r.status === status) &&
      (minAmount === null || r.amount >= minAmount) &&
      (maxAmount === null || r.amount <= maxAmount)
  );

  const customerOptions = customers.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
  }));

  // Totals cover every filtered row, not just the visible page.
  const totalBags = filtered.reduce((s, r) => s + r.quantityBags, 0);
  const totalLoading = filtered.reduce((s, r) => s + r.loadingAmount, 0);
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);

  const { page, pageCount, total, pageRows } = paginate(filtered, sp.page);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Sales
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {formatMonth(month)}
            {!isAdmin && " · your entries"}
          </p>
        </div>
        <Suspense>
          <MonthPicker value={month} />
        </Suspense>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Record Sale
        </h2>
        <CreateSaleForm customers={customerOptions} />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Suspense>
            <FilterSelect
              paramName="customer"
              value={customerId ?? ""}
              options={customerOptions.map((c) => ({
                value: c.id,
                label: c.company ? `${c.name} (${c.company})` : c.name,
              }))}
              allLabel="All customers"
            />
            <FilterSelect
              paramName="status"
              value={status ?? ""}
              options={STATUS_OPTIONS}
              allLabel="All payment statuses"
            />
            <FilterSearch
              paramName="invoice"
              value={sp.invoice ?? ""}
              placeholder="Invoice #"
            />
            <FilterRange
              minParam="min"
              maxParam="max"
              minValue={sp.min}
              maxValue={sp.max}
              placeholder={["Min amount", "Max amount"]}
            />
            {hasFilters && (
              <ResetFilters
                params={["customer", "status", "invoice", "min", "max"]}
              />
            )}
          </Suspense>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium text-right">Bags</th>
                <th className="px-4 py-3 font-medium text-right">Rate/bag</th>
                <th className="px-4 py-3 font-medium text-right">Loading</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    {hasFilters
                      ? "No sales match the current filters."
                      : `No sales for ${formatMonth(month)}.`}
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
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
                  <td className="px-4 py-3 text-right text-neutral-500 dark:text-neutral-400">
                    {formatPKR(row.loadingAmount)}
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
                            ratePerBag: row.grossRatePerBag,
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
            {filtered.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-neutral-900 dark:text-neutral-50">
                    {hasFilters ? "Filtered Total" : "Month Total"}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totalBags.toFixed(2)} bags
                  </td>
                  <td />
                  <td className="px-4 py-3 text-right text-neutral-600 dark:text-neutral-400">
                    {formatPKR(totalLoading)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {formatPKR(totalAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Suspense>
          <Pagination page={page} pageCount={pageCount} total={total} noun="sales" />
        </Suspense>
      </section>
    </div>
  );
}
