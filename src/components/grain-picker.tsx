"use client";

import { GRAIN_OPTIONS, type Grain } from "@/lib/granularity";

interface GrainPickerProps {
  value: Grain;
  onChange: (grain: Grain) => void;
}

/**
 * Daily / Weekly / Monthly segmented control. Purely presentational — state
 * lives in the surrounding GrainScope (see grain-scope.tsx), which refetches
 * only the affected chart data instead of re-rendering the whole page.
 */
export function GrainPicker({ value, onChange }: GrainPickerProps) {
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
          onClick={() => onChange(o.value)}
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
