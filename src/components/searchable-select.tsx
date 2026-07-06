"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50";

// Searchable combobox that submits its value through a hidden input.
// allowCustom lets the typed text itself be the value (e.g. new expense
// category) and shows an explicit "+ Add" row for it.
export function SearchableSelect({
  name,
  options,
  value: controlledValue,
  defaultValue = "",
  onChange,
  placeholder = "Search…",
  required = false,
  allowCustom = false,
}: {
  name: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  allowCustom?: boolean;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const labelFor = (v: string) =>
    options.find((o) => o.value === v)?.label ?? (allowCustom ? v : "");

  const [query, setQuery] = useState(() => labelFor(value));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Keep the visible text in sync when the value changes from outside
  // (e.g. quick-add auto-selecting a newly created supplier/customer).
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setQuery(labelFor(value));
  }

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!allowCustom) setQuery(labelFor(value));
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options, allowCustom]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Show the full list when the text is exactly the current selection,
    // so clicking into the field lets the user pick something else. In
    // allowCustom mode the text *is* the value, so filter normally there.
    if (!allowCustom && q === labelFor(value).trim().toLowerCase())
      return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, options, value]);

  const exactMatch = options.some(
    (o) => o.label.trim().toLowerCase() === query.trim().toLowerCase()
  );

  const setValue = (v: string) => {
    if (controlledValue === undefined) setInternalValue(v);
    onChange?.(v);
    setQuery(labelFor(v) || v);
  };

  const pick = (o: SelectOption) => {
    setValue(o.value);
    setQuery(o.label);
    setOpen(false);
  };

  const handleInput = (text: string) => {
    setQuery(text);
    setOpen(true);
    if (allowCustom) {
      const match = options.find(
        (o) => o.label.trim().toLowerCase() === text.trim().toLowerCase()
      );
      const v = match ? match.value : text.trim();
      if (controlledValue === undefined) setInternalValue(v);
      onChange?.(v);
    } else if (text === "") {
      if (controlledValue === undefined) setInternalValue("");
      onChange?.("");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        value={query}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClass}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && open) {
            e.preventDefault();
            if (filtered.length > 0) pick(filtered[0]);
            else if (allowCustom && query.trim()) {
              setValue(query.trim());
              setOpen(false);
            }
          }
        }}
        onBlur={() => {
          // Don't leave stale text that doesn't correspond to the value.
          if (!allowCustom) {
            setTimeout(() => setQuery(labelFor(value)), 150);
          }
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
        ▾
      </span>
      {open && (
        <ul
          id={listId}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  o.value === value
                    ? "font-semibold text-green-700 dark:text-green-400"
                    : "text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
          {allowCustom && query.trim() && !exactMatch && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setValue(query.trim());
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm font-medium text-green-700 hover:bg-neutral-100 dark:text-green-400 dark:hover:bg-neutral-800"
              >
                + Add “{query.trim()}”
              </button>
            </li>
          )}
          {filtered.length === 0 && !(allowCustom && query.trim()) && (
            <li className="px-3 py-2 text-sm text-neutral-400">No matches.</li>
          )}
        </ul>
      )}
    </div>
  );
}
