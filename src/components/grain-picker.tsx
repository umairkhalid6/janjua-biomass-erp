"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { GRAIN_OPTIONS } from "@/lib/granularity";

interface GrainPickerProps {
  value: string; // one of GRAIN_OPTIONS values, e.g. "monthly"
  paramName?: string;
}

/**
 * Daily / Weekly / Monthly segmented control that drives chart bucketing via a
 * `?grain=` query param. Same URL-push behaviour as PeriodPicker so the page
 * re-renders server-side with re-aggregated chart data.
 */
export function GrainPicker({ value, paramName = "grain" }: GrainPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setGrain = useCallback(
    (grain: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramName, grain);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, paramName]
  );

  return (
    <div
      role="group"
      aria-label="Chart granularity"
      className="inline-flex overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700"
    >
      {GRAIN_OPTIONS.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setGrain(o.value)}
          className={`px-2.5 py-1.5 text-xs font-medium transition ${
            i > 0 ? "border-l border-neutral-300 dark:border-neutral-700" : ""
          } ${
            value === o.value
              ? "bg-green-600 text-white"
              : "bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
