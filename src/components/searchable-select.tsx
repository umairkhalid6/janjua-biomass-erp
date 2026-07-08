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
  // Index into the rendered rows (filtered options, then the "+ Add" row).
  // -1 means nothing highlighted yet.
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  // True only after the user has typed since the dropdown last opened.
  // Resets to false on each open so clicking in always shows the full list.
  // State (not a ref) so the filtered list recomputes when it changes.
  const [typedSinceOpen, setTypedSinceOpen] = useState(false);

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
    // Show the full list when the dropdown just opened (user hasn't typed yet).
    // Once the user types, filter by the query text.
    if (!typedSinceOpen) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options, typedSinceOpen]);

  const exactMatch = options.some(
    (o) => o.label.trim().toLowerCase() === query.trim().toLowerCase()
  );

  const showAdd = allowCustom && query.trim() !== "" && !exactMatch;
  const itemCount = filtered.length + (showAdd ? 1 : 0);

  // Keep the highlighted row visible when navigating long lists.
  useEffect(() => {
    if (highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const setValue = (v: string) => {
    if (controlledValue === undefined) setInternalValue(v);
    onChange?.(v);
    setQuery(labelFor(v) || v);
  };

  const pick = (o: SelectOption) => {
    setValue(o.value);
    setQuery(o.label);
    setOpen(false);
    setHighlight(-1);
  };

  const pickAdd = () => {
    setValue(query.trim());
    setOpen(false);
    setHighlight(-1);
  };

  const handleInput = (text: string) => {
    setTypedSinceOpen(true);
    setQuery(text);
    setOpen(true);
    setHighlight(text.trim() ? 0 : -1);
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
        aria-activedescendant={
          open && highlight >= 0 ? `${listId}-opt-${highlight}` : undefined
        }
        onFocus={() => { setTypedSinceOpen(false); setOpen(true); setHighlight(-1); }}
        onClick={() => { setTypedSinceOpen(false); setOpen(true); setHighlight(-1); }}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setHighlight(-1);
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
              setTypedSinceOpen(false);
              setOpen(true);
              setHighlight(0);
              return;
            }
            if (itemCount === 0) return;
            const delta = e.key === "ArrowDown" ? 1 : -1;
            setHighlight((h) =>
              h < 0
                ? delta > 0
                  ? 0
                  : itemCount - 1
                : (h + delta + itemCount) % itemCount
            );
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            if (highlight >= 0 && highlight < itemCount) {
              if (highlight < filtered.length) pick(filtered[highlight]);
              else pickAdd();
            } else if (filtered.length > 0) pick(filtered[0]);
            else if (allowCustom && query.trim()) pickAdd();
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
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {filtered.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === highlight ? "bg-neutral-100 dark:bg-neutral-800" : ""
                } ${
                  o.value === value
                    ? "font-semibold text-green-700 dark:text-green-400"
                    : "text-neutral-700 dark:text-neutral-300"
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
          {showAdd && (
            <li id={`${listId}-opt-${filtered.length}`} role="option" aria-selected={false}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickAdd();
                }}
                onMouseEnter={() => setHighlight(filtered.length)}
                className={`block w-full px-3 py-2 text-left text-sm font-medium text-green-700 dark:text-green-400 ${
                  highlight === filtered.length
                    ? "bg-neutral-100 dark:bg-neutral-800"
                    : ""
                }`}
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
