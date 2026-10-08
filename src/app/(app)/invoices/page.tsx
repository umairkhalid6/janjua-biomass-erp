import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatDate, formatPKR, toDateInputValue } from "@/lib/format";
import { paginate } from "@/lib/pagination";
import {
  customInvoiceLabel,
  formatQty,
  invoiceTotals,
} from "@/lib/custom-invoice";
import { DeleteButton } from "@/components/delete-button";
import { EditDialog } from "@/components/edit-dialog";
import { Pagination } from "@/components/pagination";
import { FilterSearch, ResetFilters } from "@/components/table-filters";
import { CreateInvoiceForm, EditInvoiceForm } from "./invoice-forms";
import { deleteCustomInvoice } from "./actions";

// Standalone invoices typed up by the admin. Independent of Sales — nothing
// here affects customers, stock, ledgers or reports.
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const query = sp.q?.trim().toLowerCase() ?? "";

  const invoices = await prisma.customInvoice.findMany({
    orderBy: [{ date: "desc" }, { invoiceNo: "desc" }],
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  const rows = invoices.map((inv) => {
    const items = inv.items.map((it) => ({
      description: it.description,
      quantityBags: it.quantityBags.toNumber(),
      bagSizeKg: it.bagSizeKg.toNumber(),
      ratePerKg: it.ratePerKg.toNumber(),
    }));
    return {
      id: inv.id,
      label: customInvoiceLabel(inv.invoiceNo),
      date: toDateInputValue(inv.date),
      customerName: inv.customerName,
      customerAddress: inv.customerAddress,
      customerPhone: inv.customerPhone,
      notes: inv.notes,
      items,
      totals: invoiceTotals(items),
    };
  });

  const filtered = query
    ? rows.filter(
        (r) =>
          r.customerName.toLowerCase().includes(query) ||
          r.label.toLowerCase().includes(query)
      )
    : rows;

  const { page, pageCount, total, pageRows } = paginate(filtered, sp.page);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Invoices
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Standalone invoices — not linked to sales, customers or stock.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          New Invoice
        </h2>
        <CreateInvoiceForm />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Suspense>
            <FilterSearch
              paramName="q"
              value={sp.q ?? ""}
              placeholder="Search customer or invoice #"
            />
            {query && <ResetFilters params={["q"]} />}
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
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    {query
                      ? "No invoices match your search."
                      : "No invoices yet."}
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr
                  key={row.id}
                  className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${row.id}`}
                      className="font-medium text-green-700 hover:underline dark:text-green-400"
                    >
                      {row.label}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    {row.customerName}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {formatQty(row.totals.bags)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(row.totals.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/invoices/${row.id}`}
                        className="rounded border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                      >
                        View
                      </Link>
                      <EditDialog title={`Edit ${row.label}`} wide>
                        <EditInvoiceForm existing={row} />
                      </EditDialog>
                      <form action={deleteCustomInvoice}>
                        <input type="hidden" name="id" value={row.id} />
                        <DeleteButton
                          confirmMessage={`Delete invoice ${row.label}?`}
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Suspense>
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            noun="invoices"
          />
        </Suspense>
      </section>
    </div>
  );
}
