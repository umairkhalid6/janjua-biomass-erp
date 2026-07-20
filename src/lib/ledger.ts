export type BaseLedgerRow = {
  entryId: string;
  date: Date | null;
  entryType: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type FoldedLedgerRow<T extends BaseLedgerRow> = T & {
  /** Payment ids folded into this purchase/sale row (instant payments). */
  foldedPaymentIds: string[];
};

// Ledger views order entries by (date, sort_order, entry_id) but pages can only
// ORDER BY columns the view exposes to them; re-apply the same ordering here so
// a purchase/sale always precedes its same-day payment.
function entryRank(entryType: string): number {
  if (entryType === "OPENING") return 0;
  if (entryType === "PAYMENT") return 2;
  return 1;
}

/**
 * A payment recorded together with its purchase/sale (linked and dated the
 * same day) is one event to the owner — fold it into the parent row instead
 * of showing a second ledger line, then recompute running balances over the
 * folded rows. Payments made on a later date stay as their own rows.
 *
 * `paymentTarget` maps payment entryId → the purchase/sale entryId it should
 * fold into; the caller only includes same-day links.
 */
export function foldInstantPayments<T extends BaseLedgerRow>(
  rows: T[],
  paymentTarget: Map<string, string>
): FoldedLedgerRow<T>[] {
  const sorted = [...rows].sort((a, b) => {
    const at = a.date ? new Date(a.date).getTime() : -Infinity;
    const bt = b.date ? new Date(b.date).getTime() : -Infinity;
    if (at !== bt) return at - bt;
    const ar = entryRank(a.entryType);
    const br = entryRank(b.entryType);
    if (ar !== br) return ar - br;
    return a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0;
  });

  const out: FoldedLedgerRow<T>[] = [];
  const byEntryId = new Map<string, FoldedLedgerRow<T>>();
  for (const row of sorted) {
    const targetId =
      row.entryType === "PAYMENT" ? paymentTarget.get(row.entryId) : undefined;
    const target = targetId ? byEntryId.get(targetId) : undefined;
    if (target) {
      target.credit += row.credit;
      target.foldedPaymentIds.push(row.entryId);
      continue;
    }
    const folded = { ...row, foldedPaymentIds: [] as string[] };
    out.push(folded);
    byEntryId.set(folded.entryId, folded);
  }

  let running = 0;
  for (const row of out) {
    running += row.debit - row.credit;
    row.balance = running;
  }
  return out;
}
