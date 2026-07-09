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

// --- Period (trailing-month range) filtering for the dashboard & reports ---

/**
 * Selectable reporting windows. Each spans the trailing N calendar months up to
 * and including the current month (e.g. "3m" in July = May + June + July).
 */
export const PERIOD_OPTIONS = [
  { value: "1m", label: "This month", months: 1 },
  { value: "3m", label: "Last 3 months", months: 3 },
  { value: "6m", label: "Last 6 months", months: 6 },
  { value: "12m", label: "Last 12 months", months: 12 },
] as const;

export type PeriodValue = (typeof PERIOD_OPTIONS)[number]["value"];

export const DEFAULT_PERIOD: PeriodValue = "1m";

/** Coerce an arbitrary query param into a known period value (defaults to this month). */
export function parsePeriodParam(param: string | undefined): PeriodValue {
  return PERIOD_OPTIONS.find((o) => o.value === param)?.value ?? DEFAULT_PERIOD;
}

/** Number of trailing months a period value spans. */
export function periodMonths(period: PeriodValue): number {
  return PERIOD_OPTIONS.find((o) => o.value === period)?.months ?? 1;
}

/** Human label for a period value, e.g. "Last 3 months". */
export function periodLabel(period: PeriodValue): string {
  return PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "This month";
}

/**
 * UTC date range covering the trailing N months up to and including the current
 * month. `gte` is the 1st of the earliest month, `lte` the last day of the
 * current month. Safe for @db.Date comparisons and for filtering month-grain
 * views (whose `month` column is the 1st of each month).
 */
export function periodRange(period: PeriodValue): { gte: Date; lte: Date } {
  const months = periodMonths(period);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const gte = new Date(Date.UTC(y, m - (months - 1), 1));
  const lte = new Date(Date.UTC(y, m + 1, 0)); // last day of the current month
  return { gte, lte };
}
