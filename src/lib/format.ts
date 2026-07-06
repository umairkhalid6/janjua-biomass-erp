// Shared formatting helpers for the ERP app.
// All PKR amounts are stored as Prisma Decimal(14,2) — convert via .toNumber()
// before passing to these helpers.

/** Format a number as PKR currency, e.g. "PKR 1,23,456.78" */
export function formatPKR(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format a Date or ISO string as DD/MM/YYYY (local date display) */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}

/** Format a Date or YYYY-MM string as "Month YYYY" e.g. "July 2026" */
export function formatMonth(month: Date | string): string {
  const d = typeof month === "string" ? parseMonthParam(month) : month;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/**
 * Parse a YYYY-MM query param (or full date string) into a Date at UTC midnight
 * on the 1st of that month. Safe for @db.Date comparisons.
 */
export function parseMonthParam(param: string): Date {
  // Accept "YYYY-MM" or "YYYY-MM-DD"
  const parts = param.slice(0, 7).split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  return new Date(Date.UTC(year, month, 1));
}

/**
 * Parse a YYYY-MM-DD value from <input type="date"> into a Date at UTC midnight.
 * Avoids timezone shifting that `new Date("YYYY-MM-DD")` can cause.
 */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Return today's month as "YYYY-MM" for use as default query param. */
export function currentMonthParam(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Convert a Prisma Date field (stored as UTC midnight) to a YYYY-MM-DD string for <input type="date"> */
export function toDateInputValue(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Return the start and end of a month as UTC Date objects for Prisma range queries. */
export function monthRange(monthParam: string): { gte: Date; lte: Date } {
  const start = parseMonthParam(monthParam);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { gte: start, lte: end };
}
