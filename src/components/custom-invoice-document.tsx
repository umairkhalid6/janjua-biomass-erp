// Presentational document for standalone invoices (/invoices/[id]). Same look
// as the sales invoice (invoice-document.tsx) but driven entirely by what the
// admin typed: free-text customer + address and any number of line items
// priced per kg. Pure, serializable props — no data fetching.
//
// Rendered on screen and captured to PNG/PDF at a fixed 720px width (see
// src/lib/capture-element.ts), so the table layout (sm and up) is what gets
// shared; phones viewing the page get the stacked card layout.

import { formatDate, formatPKR } from "@/lib/format";
import { BrandMark } from "@/components/brand-mark";
import {
  formatQty,
  invoiceTotals,
  lineAmount,
  lineWeightKg,
  type CustomInvoiceLine,
} from "@/lib/custom-invoice";

export type CustomInvoiceDocumentProps = {
  id?: string;
  invoiceLabel: string;
  date: string | Date;
  customer: { name: string; address?: string | null; phone?: string | null };
  items: CustomInvoiceLine[];
  notes?: string | null;
};

const th =
  "px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-emerald-900";
const td = "whitespace-nowrap px-2 py-4 text-right align-top text-neutral-700";

export function CustomInvoiceDocument({
  id,
  invoiceLabel,
  date,
  customer,
  items,
  notes,
}: CustomInvoiceDocumentProps) {
  const totals = invoiceTotals(items);

  return (
    <div
      id={id}
      className="mx-auto max-w-2xl bg-white px-5 py-8 text-neutral-900 sm:px-8 sm:py-10 print:max-w-none print:px-0 print:py-0"
    >
      <div className="mb-6 h-1.5 w-full rounded-full bg-emerald-800 [print-color-adjust:exact] sm:mb-8" />

      <header className="mb-8 flex items-start justify-between gap-4 sm:mb-10 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-3.5">
          <BrandMark />
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight text-emerald-900 sm:text-xl">
              Janjua Biomass Pellets
            </h1>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-neutral-500 sm:text-xs">
              Biomass Pellet Manufacturer
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold uppercase tracking-widest text-neutral-300 print:text-neutral-400 sm:text-2xl">
            Invoice
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-800 sm:text-base">
            {invoiceLabel}
          </p>
        </div>
      </header>

      <section className="mb-8 flex flex-col gap-6 sm:mb-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
            Bill To
          </p>
          <p className="text-base font-semibold text-neutral-900">{customer.name}</p>
          {customer.address && (
            <p className="mt-0.5 whitespace-pre-line text-sm text-neutral-600">
              {customer.address}
            </p>
          )}
          {customer.phone && (
            <p className="mt-0.5 text-sm text-neutral-600">{customer.phone}</p>
          )}
        </div>
        <dl className="shrink-0 text-sm">
          <div className="flex justify-between gap-8 border-b border-neutral-200 py-1.5">
            <dt className="text-neutral-500">Invoice date</dt>
            <dd className="font-medium text-neutral-900">{formatDate(date)}</dd>
          </div>
          <div className="flex justify-between gap-8 border-b border-neutral-200 py-1.5">
            <dt className="text-neutral-500">Total bags</dt>
            <dd className="font-medium text-neutral-900">{formatQty(totals.bags)}</dd>
          </div>
          <div className="flex justify-between gap-8 py-1.5">
            <dt className="text-neutral-500">Total weight</dt>
            <dd className="font-medium text-neutral-900">
              {formatQty(totals.weightKg)} kg
            </dd>
          </div>
        </dl>
      </section>

      {/* Line items — stacked cards on phones (the 6-column table would clip). */}
      <div className="sm:hidden">
        <div className="border-y-2 border-emerald-800 bg-emerald-50 px-3 py-2 [print-color-adjust:exact]">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-900">
            Items
          </span>
        </div>
        {items.map((l, i) => (
          <div key={i} className="border-b border-neutral-200 px-3 py-4">
            <p className="font-medium text-neutral-900">{l.description}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {formatQty(l.quantityBags)} bags × {formatQty(l.bagSizeKg)} kg ={" "}
              {formatQty(lineWeightKg(l))} kg
            </p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-neutral-500">Rate</dt>
                <dd className="font-medium text-neutral-700">
                  {formatPKR(l.ratePerKg)}/kg
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-100 pt-1.5">
                <dt className="text-neutral-500">Amount</dt>
                <dd className="font-semibold text-neutral-900">
                  {formatPKR(lineAmount(l))}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <table className="hidden w-full border-collapse text-sm sm:table">
        <thead>
          <tr className="border-y-2 border-emerald-800 bg-emerald-50 [print-color-adjust:exact]">
            <th className={`${th} pl-3 text-left`}>Description</th>
            <th className={th}>Bags</th>
            <th className={th}>Bag Size</th>
            <th className={th}>Weight</th>
            <th className={th}>Rate</th>
            <th className={`${th} pr-3`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l, i) => (
            <tr key={i} className="border-b border-neutral-200">
              <td className="py-4 pl-3 pr-2 align-top font-medium text-neutral-900">
                {l.description}
              </td>
              <td className={td}>{formatQty(l.quantityBags)}</td>
              <td className={td}>{formatQty(l.bagSizeKg)} kg</td>
              <td className={td}>{formatQty(lineWeightKg(l))} kg</td>
              <td className={td}>{formatPKR(l.ratePerKg)}/kg</td>
              <td className={`${td} pr-3 font-semibold text-neutral-900`}>
                {formatPKR(lineAmount(l))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-6 flex justify-end">
        <div className="w-full sm:w-72">
          <div className="flex items-center justify-between rounded-lg bg-emerald-800 px-3 py-2.5 [print-color-adjust:exact]">
            <span className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
              Total
            </span>
            <span className="text-lg font-bold text-white">
              {formatPKR(totals.amount)}
            </span>
          </div>
        </div>
      </section>

      {notes && (
        <section className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 [print-color-adjust:exact]">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
            Notes
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">
            {notes}
          </p>
        </section>
      )}

      <footer className="mt-14 border-t border-neutral-200 pt-5 text-center">
        <p className="text-sm font-semibold text-emerald-800">
          Thank you for your business!
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
          Janjua Biomass Pellets · Pakistan · Please reference {invoiceLabel} with
          your payment.
        </p>
      </footer>
    </div>
  );
}
