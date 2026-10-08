// Helpers for standalone (hand-typed) invoices — see CustomInvoice in
// prisma/schema.prisma. These invoices are independent of sales/ledgers.

export type CustomInvoiceLine = {
  description: string;
  quantityBags: number;
  bagSizeKg: number;
  ratePerKg: number;
};

/** "JB-00001" — a different prefix from sales invoices (INV-…) so the two
 *  numbering series are never confused. */
export function customInvoiceLabel(invoiceNo: number): string {
  return `JB-${String(invoiceNo).padStart(5, "0")}`;
}

export function lineWeightKg(l: CustomInvoiceLine): number {
  return l.quantityBags * l.bagSizeKg;
}

export function lineAmount(l: CustomInvoiceLine): number {
  return Math.round(lineWeightKg(l) * l.ratePerKg * 100) / 100;
}

export function invoiceTotals(lines: CustomInvoiceLine[]) {
  return lines.reduce(
    (t, l) => ({
      bags: t.bags + l.quantityBags,
      weightKg: t.weightKg + lineWeightKg(l),
      amount: t.amount + lineAmount(l),
    }),
    { bags: 0, weightKg: 0, amount: 0 }
  );
}

/** Trim trailing zeros: 40 → "40", 12.5 → "12.5", 12.25 → "12.25". */
export function formatQty(n: number): string {
  return n.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}
