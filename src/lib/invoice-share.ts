// Helpers for sharing an invoice on WhatsApp via a wa.me click-to-share link.
// No API/cost: we build a wa.me URL that opens WhatsApp pre-filled with a
// message and a link to the public (tokenized) invoice page.

import { toWhatsappNumber } from "./phone";

/** The public path for a shared invoice, given its share token. */
export function invoicePath(token: string): string {
  return `/i/${token}`;
}

/** Formatted-amount breakdown shown in captions; optional rows are omitted. */
export type InvoiceAmounts = {
  invoiceAmount: string; // e.g. "PKR 99,600.00"
  previousBalance?: string | null; // only when dues were carried forward
  totalPayable?: string | null; // only alongside previousBalance
  amountReceived?: string | null; // only when a payment was recorded
  balanceDue: string;
};

/**
 * Caption sent alongside the invoice IMAGE via the native share sheet
 * (navigator.share). No link — the invoice travels as an attached PNG.
 * Mirrors the invoice's totals block: previous balance and received amount
 * appear only when they exist.
 */
export function invoiceCaption(opts: {
  customerName: string;
  invoiceLabel: string;
  amounts: InvoiceAmounts;
}): string {
  const { amounts } = opts;
  const lines = [
    `Assalam-o-Alaikum ${opts.customerName},`,
    ``,
    `Please find your invoice ${opts.invoiceLabel} from Janjua Biomass Pellets.`,
    `Invoice amount: ${amounts.invoiceAmount}`,
  ];
  if (amounts.previousBalance) {
    lines.push(`Previous balance: ${amounts.previousBalance}`);
    if (amounts.totalPayable) lines.push(`Total payable: ${amounts.totalPayable}`);
  }
  if (amounts.amountReceived) {
    lines.push(`Amount received: ${amounts.amountReceived}`);
  }
  lines.push(
    `Balance due: ${amounts.balanceDue}`,
    ``,
    `JazakAllah for your business.`
  );
  return lines.join("\n");
}

/**
 * Build the pre-filled WhatsApp message body. `invoiceUrl` must be absolute
 * (built on the client from window.location.origin + invoicePath(token)).
 * Retained for the future WhatsApp Business API path (attachments + a hosted
 * URL); the click-to-share button now sends the image, not a link.
 */
export function invoiceShareMessage(opts: {
  customerName: string;
  invoiceLabel: string;
  amount: string; // already formatted, e.g. "PKR 99,600.00"
  invoiceUrl: string;
}): string {
  return [
    `Assalam-o-Alaikum ${opts.customerName},`,
    ``,
    `Your invoice ${opts.invoiceLabel} from Janjua Biomass Pellets is ready.`,
    `Amount due: ${opts.amount}`,
    ``,
    `View / download your invoice here:`,
    opts.invoiceUrl,
    ``,
    `JazakAllah for your business.`,
  ].join("\n");
}

/**
 * Build a wa.me URL. If the phone can be normalized, it opens a chat with that
 * contact; otherwise it opens WhatsApp's contact picker with the message
 * pre-filled.
 */
export function buildWhatsappUrl(opts: {
  phone?: string | null;
  message: string;
}): string {
  const number = toWhatsappNumber(opts.phone);
  const text = encodeURIComponent(opts.message);
  return number
    ? `https://wa.me/${number}?text=${text}`
    : `https://wa.me/?text=${text}`;
}
