"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50";

export type FilterOption = { value: string; label: string };

// Applies query-param updates (null/"" deletes the param) and drops the
// pagination param so every filter change lands back on page 1.
function useFilterNavigation(pageParam: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (
      updates: Record<string, string | null>,
      mode: "push" | "replace" = "push"
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete(pageParam);
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "replace") router.replace(url);
      else router.push(url);
    },
    [router, pathname, searchParams, pageParam]
  );
}

// Dropdown filter; the empty first option ("All …") clears the param.
export function FilterSelect({
  paramName,
  value,
  options,
  allLabel,
  pageParam = "page",
}: {
  paramName: string;
  value: string;
  options: FilterOption[];
  allLabel: string;
  pageParam?: string;
}) {
  const navigate = useFilterNavigation(pageParam);
  return (
    <select
      value={value}
      aria-label={allLabel}
      onChange={(e) => navigate({ [paramName]: e.target.value || null })}
      className={inputClass}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// Debounced text filter. `lastApplied` distinguishes the URL catching up to
// our own push (ignore) from an outside change like the reset link (adopt).
export function FilterSearch({
  paramName,
  value,
  placeholder,
  pageParam = "page",
}: {
  paramName: string;
  value: string;
  placeholder: string;
  pageParam?: string;
}) {
  const navigate = useFilterNavigation(pageParam);
  const [text, setText] = useState(value);
  const lastApplied = useRef(value);

  useEffect(() => {
    if (value !== lastApplied.current) {
      lastApplied.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text.trim() === lastApplied.current) return;
    const t = setTimeout(() => {
      lastApplied.current = text.trim();
      navigate({ [paramName]: text.trim() || null }, "replace");
    }, 350);
    return () => clearTimeout(t);
  }, [text, paramName, navigate]);

  return (
    <input
      type="search"
      value={text}
      aria-label={placeholder}
      onChange={(e) => setText(e.target.value)}
      placeholder={placeholder}
      className={`${inputClass} w-36`}
    />
  );
}

// Debounced numeric min/max pair (amount or rate ranges).
export function FilterRange({
  minParam,
  maxParam,
  minValue = "",
  maxValue = "",
  placeholder = ["Min", "Max"],
  pageParam = "page",
}: {
  minParam: string;
  maxParam: string;
  minValue?: string;
  maxValue?: string;
  placeholder?: [string, string];
  pageParam?: string;
}) {
  const navigate = useFilterNavigation(pageParam);
  const [min, setMin] = useState(minValue);
  const [max, setMax] = useState(maxValue);
  const lastApplied = useRef(`${minValue}|${maxValue}`);

  useEffect(() => {
    const incoming = `${minValue}|${maxValue}`;
    if (incoming !== lastApplied.current) {
      lastApplied.current = incoming;
      setMin(minValue);
      setMax(maxValue);
    }
  }, [minValue, maxValue]);

  useEffect(() => {
    const next = `${min.trim()}|${max.trim()}`;
    if (next === lastApplied.current) return;
    const t = setTimeout(() => {
      lastApplied.current = next;
      navigate(
        { [minParam]: min.trim() || null, [maxParam]: max.trim() || null },
        "replace"
      );
    }, 350);
    return () => clearTimeout(t);
  }, [min, max, minParam, maxParam, navigate]);

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        value={min}
        aria-label={placeholder[0]}
        onChange={(e) => setMin(e.target.value)}
        placeholder={placeholder[0]}
        className={`${inputClass} w-28`}
      />
      <span className="text-xs text-neutral-400">–</span>
      <input
        type="number"
        inputMode="decimal"
        value={max}
        aria-label={placeholder[1]}
        onChange={(e) => setMax(e.target.value)}
        placeholder={placeholder[1]}
        className={`${inputClass} w-28`}
      />
    </div>
  );
}

// Clears the listed filter params (month picker survives — not listed).
export function ResetFilters({
  params,
  pageParam = "page",
}: {
  params: string[];
  pageParam?: string;
}) {
  const navigate = useFilterNavigation(pageParam);
  return (
    <button
      type="button"
      onClick={() =>
        navigate(Object.fromEntries(params.map((p) => [p, null])))
      }
      className="text-xs font-medium text-green-700 underline dark:text-green-400"
    >
      Reset filters
    </button>
  );
}
