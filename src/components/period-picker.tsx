"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

const CUSTOM_VALUE = "custom";

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
 * either a trailing window (this month / last 3, 6, 12 months), one specific
 * calendar month (1st to last day), or an explicit `?from=&to=` date range
 * picked from "Custom range". Mirrors MonthPicker's URL-push behaviour so the
 * page re-renders server-side with the new range.
 */
export function PeriodPicker({
  value,
  paramName = "period",
  startMonth = DATA_START_MONTH,
}: PeriodPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const hasCustomInUrl = Boolean(fromParam && toParam);

  const [showCustom, setShowCustom] = useState(hasCustomInUrl);
  const [draftFrom, setDraftFrom] = useState(fromParam);
  const [draftTo, setDraftTo] = useState(toParam);

  // Keep local state in sync with the URL (back/forward nav, or another
  // control resetting the filter) without clobbering mid-edit keystrokes.
  useEffect(() => {
    setShowCustom(hasCustomInUrl);
    setDraftFrom(fromParam);
    setDraftTo(toParam);
  }, [hasCustomInUrl, fromParam, toParam]);

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

  const handleSelectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value;
      if (next === CUSTOM_VALUE) {
        setShowCustom(true);
        return;
      }
      setShowCustom(false);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("from");
      params.delete("to");
      params.set(paramName, next);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, paramName]
  );

  const applyCustomRange = useCallback(
    (from: string, to: string) => {
      if (!from || !to || from > to) return;
      const params = new URLSearchParams(searchParams.toString());
      params.delete(paramName);
      params.set("from", from);
      params.set("to", to);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, paramName]
  );

  const handleFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setDraftFrom(next);
      applyCustomRange(next, draftTo);
    },
    [draftTo, applyCustomRange]
  );

  const handleToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setDraftTo(next);
      applyCustomRange(draftFrom, next);
    },
    [draftFrom, applyCustomRange]
  );

  const inputClass =
    "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={showCustom ? CUSTOM_VALUE : value} onChange={handleSelectChange} className={inputClass}>
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>Custom range…</option>
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
      {showCustom && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={draftFrom}
            max={draftTo || undefined}
            onChange={handleFromChange}
            aria-label="From date"
            className={inputClass}
          />
          <span className="text-xs text-neutral-500">to</span>
          <input
            type="date"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={handleToChange}
            aria-label="To date"
            className={inputClass}
          />
        </div>
      )}
    </div>
  );
}
