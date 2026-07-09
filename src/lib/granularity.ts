// Chart granularity (grain) helpers. Charts across the dashboard and reports
// can bucket their series by day, ISO week (Monday start, matching Postgres
// date_trunc('week')), or calendar month via a `?grain=` query param.

export const GRAIN_OPTIONS = [
  { value: "daily", label: "Daily", unit: "day" },
  { value: "weekly", label: "Weekly", unit: "week" },
  { value: "monthly", label: "Monthly", unit: "month" },
] as const;

export type Grain = (typeof GRAIN_OPTIONS)[number]["value"];

export const DEFAULT_GRAIN: Grain = "monthly";

/** Coerce an arbitrary query param into a known grain (defaults to monthly). */
export function parseGrainParam(param: string | undefined): Grain {
  return GRAIN_OPTIONS.find((o) => o.value === param)?.value ?? DEFAULT_GRAIN;
}

/** SQL unit for date_trunc: 'day' | 'week' | 'month'. */
export function grainUnit(grain: Grain): "day" | "week" | "month" {
  return GRAIN_OPTIONS.find((o) => o.value === grain)!.unit;
}

/** Default trailing window size per grain: 30 days / 12 weeks / 12 months. */
export function defaultGrainBuckets(grain: Grain): number {
  return grain === "daily" ? 30 : 12;
}

/** Truncate a date to the UTC start of its bucket (Monday for weeks). */
export function bucketStart(grain: Grain, date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  if (grain === "monthly") return new Date(Date.UTC(y, m, 1));
  if (grain === "weekly") {
    const mondayOffset = (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
    return new Date(Date.UTC(y, m, d - mondayOffset));
  }
  return new Date(Date.UTC(y, m, d));
}

/**
 * UTC start of the oldest bucket in a trailing window of `buckets` buckets,
 * ending at (and including) the current bucket. The current local day is used
 * as "now", mirroring periodRange().
 */
export function grainWindowStart(grain: Grain, buckets: number): Date {
  const now = new Date();
  const cur = bucketStart(
    grain,
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  );
  const y = cur.getUTCFullYear();
  const m = cur.getUTCMonth();
  const d = cur.getUTCDate();
  if (grain === "monthly") return new Date(Date.UTC(y, m - (buckets - 1), 1));
  if (grain === "weekly") return new Date(Date.UTC(y, m, d - 7 * (buckets - 1)));
  return new Date(Date.UTC(y, m, d - (buckets - 1)));
}

/** Short axis label: "26 Jun" for daily/weekly buckets, "Jun 26" for months. */
export function bucketLabel(grain: Grain, date: Date): string {
  const d = new Date(date);
  if (grain === "monthly") {
    return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Long label for tables: "26 June 2026" / "Week of 23 Jun 2026" / "June 2026". */
export function bucketLabelLong(grain: Grain, date: Date): string {
  const d = new Date(date);
  if (grain === "monthly") {
    return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  if (grain === "weekly") {
    return (
      "Week of " +
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    );
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Human description of the trailing window, e.g. "last 12 weeks". */
export function grainWindowLabel(grain: Grain, buckets: number): string {
  const noun = grain === "daily" ? "day" : grain === "weekly" ? "week" : "month";
  return `last ${buckets} ${noun}${buckets === 1 ? "" : "s"}`;
}
