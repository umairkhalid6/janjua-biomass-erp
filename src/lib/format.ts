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
  // Month starts are stored/parsed at UTC midnight — format in UTC so a
  // negative-offset locale doesn't roll them back into the previous month.
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
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
 * Selectable trailing windows. Each spans the trailing N calendar months up to
 * and including the current month (e.g. "3m" in July = May + June + July).
 *
 * A period may also be a single calendar month given as "YYYY-MM" — see
 * isMonthPeriod() — which spans the 1st to the last day of that month.
 */
export const PERIOD_OPTIONS = [
  { value: "1m", label: "This month", months: 1 },
  { value: "3m", label: "Last 3 months", months: 3 },
  { value: "6m", label: "Last 6 months", months: 6 },
  { value: "12m", label: "Last 12 months", months: 12 },
] as const;

export type TrailingPeriod = (typeof PERIOD_OPTIONS)[number]["value"];

/** Either a trailing window ("3m") or a single calendar month ("2026-07"). */
export type PeriodValue = TrailingPeriod | (string & {});

export const DEFAULT_PERIOD: PeriodValue = "1m";

const MONTH_PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True when a period value selects one calendar month, e.g. "2026-07". */
export function isMonthPeriod(period: PeriodValue): boolean {
  return MONTH_PERIOD_RE.test(period);
}

/**
 * Coerce an arbitrary query param into a known period value: a trailing window
 * ("1m"/"3m"/"6m"/"12m") or a single month ("YYYY-MM"). Defaults to this month.
 */
export function parsePeriodParam(param: string | undefined): PeriodValue {
  if (param && isMonthPeriod(param)) return param;
  return PERIOD_OPTIONS.find((o) => o.value === param)?.value ?? DEFAULT_PERIOD;
}

/** Number of calendar months a period value spans. */
export function periodMonths(period: PeriodValue): number {
  if (isMonthPeriod(period)) return 1;
  return PERIOD_OPTIONS.find((o) => o.value === period)?.months ?? 1;
}

/** Human label for a period value, e.g. "Last 3 months" or "July 2026". */
export function periodLabel(period: PeriodValue): string {
  if (isMonthPeriod(period)) return formatMonth(period);
  return PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "This month";
}

/**
 * Label for use mid-sentence ("No sales in …"). Trailing windows read better
 * lowercased; a month name keeps its capital, e.g. "July 2026".
 */
export function periodLabelLower(period: PeriodValue): string {
  const label = periodLabel(period);
  return isMonthPeriod(period) ? label : label.toLowerCase();
}

/**
 * UTC date range for a period. For a single month ("YYYY-MM") that is the 1st
 * to the last day of that month; for a trailing window it covers the N months
 * up to and including the current month — `gte` is the 1st of the earliest
 * month, `lte` the last day of the current month. Safe for @db.Date comparisons
 * and for filtering month-grain views (whose `month` column is the 1st of each
 * month).
 */
export function periodRange(period: PeriodValue): { gte: Date; lte: Date } {
  if (isMonthPeriod(period)) return monthRange(period);
  const months = periodMonths(period);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const gte = new Date(Date.UTC(y, m - (months - 1), 1));
  const lte = new Date(Date.UTC(y, m + 1, 0)); // last day of the current month
  return { gte, lte };
}

/**
 * The last `count` calendar months ending at `now` (most recent first), as
 * period options: `{ value: "2026-07", label: "July 2026" }`.
 */
export function recentMonthPeriods(
  count = 24,
  now: Date = new Date()
): { value: string; label: string }[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { value, label: formatMonth(value) };
  });
}
