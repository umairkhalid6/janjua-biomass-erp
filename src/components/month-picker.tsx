"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

interface MonthPickerProps {
  value: string; // "YYYY-MM"
  paramName?: string;
  /**
   * Also offer a "Custom range" toggle that sets `?from=&to=` (YYYY-MM-DD).
   * While a range is in the URL it takes precedence over the month; picking a
   * month again clears it.
   */
  allowCustomRange?: boolean;
  /** Pagination params to reset when the range changes. */
  pageParams?: string[];
}

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50";

const DEFAULT_PAGE_PARAMS = ["page"];

export function MonthPicker({ value, paramName = "month", allowCustomRange = false, pageParams = DEFAULT_PAGE_PARAMS }: MonthPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get("from") ?? "";
  const toParam = searchParams.get("to") ?? "";
  const hasCustomInUrl = allowCustomRange && Boolean(fromParam && toParam);

  const [showCustom, setShowCustom] = useState(hasCustomInUrl);
  const [draftFrom, setDraftFrom] = useState(fromParam);
  const [draftTo, setDraftTo] = useState(toParam);

  // Keep local state in sync with the URL (back/forward nav, or another
  // control resetting the filter) without clobbering mid-edit keystrokes.
  // Adjusted during render rather than in an effect, per React's guidance.
  const urlKey = `${hasCustomInUrl}|${fromParam}|${toParam}`;
  const [syncedKey, setSyncedKey] = useState(urlKey);
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    setShowCustom(hasCustomInUrl);
    setDraftFrom(fromParam);
    setDraftTo(toParam);
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramName, e.target.value);
      if (allowCustomRange) {
        params.delete("from");
        params.delete("to");
        for (const p of pageParams) params.delete(p);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, paramName, allowCustomRange, pageParams]
  );

  const applyCustomRange = useCallback(
    (from: string, to: string) => {
      if (!from || !to || from > to) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("from", from);
      params.set("to", to);
      for (const p of pageParams) params.delete(p);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, pageParams]
  );

  const clearCustomRange = useCallback(() => {
    setShowCustom(false);
    if (!hasCustomInUrl) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    for (const p of pageParams) params.delete(p);
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams, hasCustomInUrl, pageParams]);

  if (!allowCustomRange) {
    return <input type="month" value={value} onChange={handleChange} className={inputClass} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showCustom ? (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={draftFrom}
            max={draftTo || undefined}
            onChange={(e) => {
              setDraftFrom(e.target.value);
              applyCustomRange(e.target.value, draftTo);
            }}
            aria-label="From date"
            className={inputClass}
          />
          <span className="text-xs text-neutral-500">to</span>
          <input
            type="date"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(e) => {
              setDraftTo(e.target.value);
              applyCustomRange(draftFrom, e.target.value);
            }}
            aria-label="To date"
            className={inputClass}
          />
        </div>
      ) : (
        <input type="month" value={value} onChange={handleChange} className={inputClass} />
      )}
      <button
        type="button"
        onClick={showCustom ? clearCustomRange : () => setShowCustom(true)}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        {showCustom ? "By month" : "Custom range"}
      </button>
    </div>
  );
}
