// Presentational invoice document, shared by the authenticated invoice page
// (/sales/[id]/invoice) and the public shared link (/i/[token]). Pure, fully
// serializable props — no data fetching here. This is the file to restyle for
// invoice design changes.
//
// Print notes: this renders on screen AND via window.print() (save-to-PDF), so
// it must stay clean on white A4 paper. Structure is carried by borders and
// typography; the few tinted fills use [print-color-adjust:exact] so they
// survive printing but degrade gracefully if a browser strips backgrounds.

import { formatDate, formatPKR } from "@/lib/format";
import { BAG_KG } from "@/lib/constants";

export type InvoiceDocumentProps = {
  invoiceLabel: string;
  /** ISO date string (YYYY-MM-DD) or Date */
  date: string | Date;
  customer: { name: string; company?: string | null; phone?: string | null };
  quantityBags: number;
  ratePerBag: number;
  notes?: string | null;
  /** Optional DOM id on the root — used to capture the invoice as an image. */
  id?: string;
};

/** Simple CSS/SVG brand mark: a leaf inside a dark-green rounded tile. */
function BrandMark() {
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-800 [print-color-adjust:exact]"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-50" fill="currentColor">
        {/* Leaf */}
        <path d="M19.5 4.5c-6.5-.6-11.2 1.3-13.3 4.6-1.5 2.4-1.3 5.3.2 7.4.4-2.7 1.7-5.2 3.8-7.1a13 13 0 0 1 5.3-2.9c-2.4 1.3-4.4 3-5.8 5.2A13.6 13.6 0 0 0 7.6 18c.4.4.8.7 1.3 1 2.7 1.3 5.9.8 8-1.3 2.6-2.6 2.9-8.4 2.6-13.2z" />
      </svg>
    </div>
  );
}

export function InvoiceDocument({
  invoiceLabel,
  date,
  customer,
  quantityBags,
  ratePerBag,
  notes,
  id,
}: InvoiceDocumentProps) {
  const amount = quantityBags * ratePerBag;
  const weightKg = quantityBags * BAG_KG;

  return (
    <div
      id={id}
      className="mx-auto max-w-2xl bg-white px-8 py-10 text-neutral-900 print:max-w-none print:px-0 print:py-0"
    >
      {/* Brand accent rule */}
      <div className="mb-8 h-1.5 w-full rounded-full bg-emerald-800 [print-color-adjust:exact]" />

      {/* Header: brand vs invoice meta */}
      <header className="mb-10 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3.5">
          <BrandMark />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-emerald-900">
              Janjua Biomass Pellets
            </h1>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-neutral-500">
              Biomass Pellet Manufacturer
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold uppercase tracking-widest text-neutral-300 print:text-neutral-400">
            Invoice
          </p>
          <p className="mt-1 text-base font-semibold text-emerald-800">
            {invoiceLabel}
          </p>
        </div>
      </header>

      {/* Bill To + invoice details */}
      <section className="mb-10 flex items-start justify-between gap-8">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
            Bill To
          </p>
          <p className="text-base font-semibold text-neutral-900">
            {customer.name}
          </p>
          {customer.company && (
            <p className="mt-0.5 text-sm text-neutral-600">{customer.company}</p>
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
            <dt className="text-neutral-500">Quantity</dt>
            <dd className="font-medium text-neutral-900">
              {quantityBags.toFixed(2)} bags
            </dd>
          </div>
          <div className="flex justify-between gap-8 py-1.5">
            <dt className="text-neutral-500">Total weight</dt>
            <dd className="font-medium text-neutral-900">
              {weightKg.toFixed(2)} kg
            </dd>
          </div>
        </dl>
      </section>

      {/* Line items */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-emerald-800 bg-emerald-50 [print-color-adjust:exact]">
            <th className="py-2.5 pl-3 pr-2 text-left text-[11px] font-semibold uppercase tracking-widest text-emerald-900">
              Description
            </th>
            <th className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-emerald-900">
              Qty
            </th>
            <th className="px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-emerald-900">
              Rate
            </th>
            <th className="py-2.5 pl-2 pr-3 text-right text-[11px] font-semibold uppercase tracking-widest text-emerald-900">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-neutral-200">
            <td className="py-4 pl-3 pr-2 align-top">
              <p className="font-medium text-neutral-900">Biomass Pellets</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {quantityBags.toFixed(2)} bags × {BAG_KG} kg/bag ={" "}
                {weightKg.toFixed(2)} kg
              </p>
            </td>
            <td className="whitespace-nowrap px-2 py-4 text-right align-top text-neutral-700">
              {quantityBags.toFixed(2)} bags
            </td>
            <td className="whitespace-nowrap px-2 py-4 text-right align-top text-neutral-700">
              {formatPKR(ratePerBag)}/bag
            </td>
            <td className="whitespace-nowrap py-4 pl-2 pr-3 text-right align-top font-semibold text-neutral-900">
              {formatPKR(amount)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <section className="mt-6 flex justify-end">
        <div className="w-72">
          <div className="flex items-center justify-between px-3 py-1.5 text-sm">
            <span className="text-neutral-500">Subtotal</span>
            <span className="font-medium text-neutral-900">
              {formatPKR(amount)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between rounded-lg bg-emerald-800 px-3 py-2.5 [print-color-adjust:exact]">
            <span className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
              Total Due
            </span>
            <span className="text-lg font-bold text-white">
              {formatPKR(amount)}
            </span>
          </div>
        </div>
      </section>

      {/* Notes */}
      {notes && (
        <section className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4 [print-color-adjust:exact]">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
            Notes
          </p>
          <p className="text-sm leading-relaxed text-neutral-700">{notes}</p>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-14 border-t border-neutral-200 pt-5 text-center">
        <p className="text-sm font-semibold text-emerald-800">
          Thank you for your business!
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
          Janjua Biomass Pellets · Pakistan · Pellets supplied in {BAG_KG} kg
          bags · Please reference {invoiceLabel} with your payment.
        </p>
      </footer>
    </div>
  );
}
