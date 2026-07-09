// Balance figures for one invoice, derived from the customer's running
// ledger (v_customer_ledger). "Previous balance" is CHRONOLOGICAL: the
// ledger balance immediately before this sale's entry — so an invoice keeps
// showing the same figures even after later sales/payments are recorded
// (unlike a live "outstanding" that would rewrite history on reprint).

import { prisma } from "./prisma";

export type InvoiceBalances = {
  /** This invoice's gross amount (qty × customer-facing rate). */
  invoiceTotal: number;
  /** Customer's ledger balance just before this invoice. >0 = dues carried. */
  previousBalance: number;
  /** invoiceTotal + previousBalance. */
  totalPayable: number;
  /** Sum of payments recorded against this specific invoice. */
  amountReceived: number;
  /** totalPayable − amountReceived. */
  balanceDue: number;
};

export async function getInvoiceBalances(saleId: string): Promise<InvoiceBalances> {
  const [ledgerRows, received] = await Promise.all([
    prisma.$queryRaw<
      { balance: unknown; amount: unknown }[]
    >`SELECT balance, amount FROM v_customer_ledger WHERE entry_id = ${saleId}`,
    prisma.customerPayment.aggregate({
      where: { saleId },
      _sum: { amount: true },
    }),
  ]);

  // The sale's ledger row carries the gross invoice amount and the running
  // balance INCLUDING it; subtracting gives the balance just before it.
  const row = ledgerRows[0];
  const invoiceTotal = row ? Number(row.amount) : 0;
  const previousBalance = row ? Number(row.balance) - invoiceTotal : 0;
  const amountReceived = received._sum?.amount?.toNumber() ?? 0;
  const totalPayable = invoiceTotal + previousBalance;

  return {
    invoiceTotal,
    previousBalance,
    totalPayable,
    amountReceived,
    balanceDue: totalPayable - amountReceived,
  };
}
