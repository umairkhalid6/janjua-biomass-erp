// Pure ledger-aging helper — dependency-free, safe for server and client.
// Buckets a "days since last activity/payment" figure into a receivables
// aging tone used by <AgingBadge /> and the customer/supplier ledger pages.

export type AgingTone = "ok" | "warn" | "danger";

export type AgingBucket = { label: string; tone: AgingTone };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days elapsed since `date` (floored, never negative). */
export function daysSince(date: Date | string, now: Date = new Date()): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.floor((now.getTime() - d.getTime()) / DAY_MS);
  return Math.max(0, diff);
}

/**
 * Bucket a number of overdue days into an aging tone.
 * 0–30 days → "Current" (ok), 31–60 → "31–60d" (warn), 61+ → "60+d" (danger).
 */
export function agingBucketFromDays(daysOverdue: number): AgingBucket {
  const days = Math.max(0, Math.floor(daysOverdue));
  if (days <= 30) return { label: "Current", tone: "ok" };
  if (days <= 60) return { label: "31–60d", tone: "warn" };
  return { label: "60+d", tone: "danger" };
}

/**
 * Bucket a last-payment/last-activity date into an aging tone.
 * `null`/invalid dates fall into the danger bucket ("No activity") since an
 * account with no recorded payment is the riskiest case.
 */
export function agingBucket(date: Date | string | null): AgingBucket {
  if (date === null) return { label: "No activity", tone: "danger" };
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return { label: "No activity", tone: "danger" };
  return agingBucketFromDays(daysSince(d));
}
