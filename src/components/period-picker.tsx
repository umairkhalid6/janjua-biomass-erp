"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { PERIOD_OPTIONS } from "@/lib/format";

interface PeriodPickerProps {
  value: string; // one of PERIOD_OPTIONS values, e.g. "3m"
  paramName?: string;
}

/**
 * Dropdown that drives the trailing-month reporting window via a `?period=`
 * query param. Mirrors MonthPicker's URL-push behaviour so the page re-renders
 * server-side with the new range.
 */
export function PeriodPicker({ value, paramName = "period" }: PeriodPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
    </select>
  );
}
