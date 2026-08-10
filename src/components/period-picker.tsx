"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  DATA_START_MONTH,
  PERIOD_OPTIONS,
  currentMonthParam,
  formatMonth,
  isMonthPeriod,
  monthPeriodOptions,
} from "@/lib/format";

interface PeriodPickerProps {
  value: string; // a trailing window ("3m") or a single month ("2026-07")
  paramName?: string;
  /** Earliest month to offer, as "YYYY-MM". Defaults to the first month with data. */
  startMonth?: string;
}

type MonthOption = { value: string; label: string };

// The month list depends on "now", which can differ between the server's clock
// and the browser's at a month boundary — so it is a client-only value, read
// through useSyncExternalStore to keep hydration clean. Snapshots must be
// referentially stable across renders, hence the cache (keyed by month so the
// list still refreshes if a tab is left open past midnight on the 1st).
const NO_MONTHS: MonthOption[] = [];
const monthCache = new Map<string, MonthOption[]>();

function monthSnapshot(startMonth: string): MonthOption[] {
  const key = `${startMonth}:${currentMonthParam()}`;
  let list = monthCache.get(key);
  if (!list) {
    list = monthPeriodOptions(startMonth);
    monthCache.clear();
    monthCache.set(key, list);
  }
  return list;
}

const subscribeNever = () => () => {};

/**
 * Dropdown that drives the reporting window via a `?period=` query param —
 * either a trailing window (this month / last 3, 6, 12 months) or one specific
 * calendar month (1st to last day). Mirrors MonthPicker's URL-push behaviour so
 * the page re-renders server-side with the new range.
 */
export function PeriodPicker({
  value,
  paramName = "period",
  startMonth = DATA_START_MONTH,
}: PeriodPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const listedMonths = useSyncExternalStore(
    subscribeNever,
    () => monthSnapshot(startMonth),
    () => NO_MONTHS
  );

  // Always offer the selected month, even before the client list arrives or
  // when it falls outside the range (e.g. a bookmarked URL). Its label comes
  // from the value itself, so it renders identically on server and client.
  const months = useMemo(() => {
    if (!isMonthPeriod(value) || listedMonths.some((o) => o.value === value)) return listedMonths;
    return [...listedMonths, { value, label: formatMonth(value) }];
  }, [listedMonths, value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramName, e.target.value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, paramName]
  );

  return (
    <select
      value={value}
      onChange={handleChange}
      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50"
    >
      {PERIOD_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {months.length > 0 && (
        <optgroup label="Specific month">
          {months.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
