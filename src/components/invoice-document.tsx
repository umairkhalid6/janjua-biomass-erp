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
  /**
   * Customer's ledger balance carried from before this invoice.
   * Positive = dues (shown as "Previous Balance"); negative = advance credit
   * (shown as a deduction); 0/omitted = the row is hidden entirely.
   */
  previousBalance?: number;
  /** Payments received against this invoice; hidden when 0/omitted. */
  amountReceived?: number;
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
  previousBalance = 0,
  amountReceived = 0,
  id,
}: InvoiceDocumentProps) {
  const amount = quantityBags * ratePerBag;
  const weightKg = quantityBags * BAG_KG;
  const totalPayable = amount + previousBalance;
  const balanceDue = totalPayable - amountReceived;
  // Decimal noise guard: treat sub-paisa remainders as settled.
  const isPaid = amountReceived > 0 && balanceDue < 0.005;

  return (
    <div
      id={id}
      className="mx-auto max-w-2xl bg-white px-5 py-8 text-neutral-900 sm:px-8 sm:py-10 print:max-w-none print:px-0 print:py-0"
    >
      {/* Brand accent rule */}
      <div className="mb-6 h-1.5 w-full rounded-full bg-emerald-800 [print-color-adjust:exact] sm:mb-8" />

      {/* Header: brand vs invoice meta */}
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

      {/* Bill To + invoice details */}
      <section className="mb-8 flex flex-col gap-6 sm:mb-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
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

      {/* Line items — mobile card (screens < sm). The 4-column table below
          would overflow a phone's width and clip the Rate/Amount columns, so
          on small screens the single line item is shown stacked instead. */}
      <div className="sm:hidden">
        <div className="border-y-2 border-emerald-800 bg-emerald-50 px-3 py-2 [print-color-adjust:exact]">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-900">
            Item
          </span>
        </div>
        <div className="border-b border-neutral-200 px-3 py-4">
          <p className="font-medium text-neutral-900">Biomass Pellets</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {quantityBags.toFixed(2)} bags × {BAG_KG} kg/bag ={" "}
            {weightKg.toFixed(2)} kg
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">Qty</dt>
              <dd className="font-medium text-neutral-700">
                {quantityBags.toFixed(2)} bags
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-500">Rate</dt>
              <dd className="font-medium text-neutral-700">
                {formatPKR(ratePerBag)}/bag
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-100 pt-1.5">
              <dt className="text-neutral-500">Amount</dt>
              <dd className="font-semibold text-neutral-900">
                {formatPKR(amount)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Line items — table (sm and up, including print & the shared PNG which
          is captured at a fixed 720px width). */}
      <table className="hidden w-full border-collapse text-sm sm:table">
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

      {/* Totals — previous dues and received amounts appear only when they
          exist, so a plain fully-new invoice stays as clean as before. */}
      <section className="mt-6 flex justify-end">
        <div className="w-full sm:w-72">
          <div className="flex items-center justify-between px-3 py-1.5 text-sm">
            <span className="text-neutral-500">This Invoice</span>
            <span className="font-medium text-neutral-900">
              {formatPKR(amount)}
            </span>
          </div>
          {previousBalance > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="text-neutral-500">Previous Balance</span>
              <span className="font-medium text-amber-700">
                {formatPKR(previousBalance)}
              </span>
            </div>
          )}
          {previousBalance < 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="text-neutral-500">Advance Paid</span>
              <span className="font-medium text-emerald-700">
                − {formatPKR(-previousBalance)}
              </span>
            </div>
          )}
          {previousBalance !== 0 && (
            <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-1.5 text-sm">
              <span className="font-medium text-neutral-600">
                Total Payable
              </span>
              <span className="font-semibold text-neutral-900">
                {formatPKR(totalPayable)}
              </span>
            </div>
          )}
          {amountReceived > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span className="text-neutral-500">Amount Received</span>
              <span className="font-medium text-emerald-700">
                − {formatPKR(amountReceived)}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between rounded-lg bg-emerald-800 px-3 py-2.5 [print-color-adjust:exact]">
            <span className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
              Balance Due
            </span>
            <span className="text-lg font-bold text-white">
              {formatPKR(Math.max(balanceDue, 0))}
            </span>
          </div>
          {isPaid && (
            <p className="mt-2 text-center text-xs font-semibold uppercase tracking-widest text-emerald-700">
              ✓ Paid in full — thank you!
            </p>
          )}
          {balanceDue < -0.005 && (
            <p className="mt-2 text-center text-xs font-medium text-emerald-700">
              Advance on account: {formatPKR(-balanceDue)}
            </p>
          )}
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
