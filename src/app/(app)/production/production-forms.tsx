"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { upsertProductionDay, type ActionState } from "./actions";
import { SearchableSelect } from "@/components/searchable-select";
import { DateInput } from "@/components/date-input";
import { BAG_SIZES } from "@/lib/constants";

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

type ProductionDayRow = {
  id: string;
  date: string; // YYYY-MM-DD
  dayShiftBags: number;
  nightShiftBags: number;
  dayBagKg: number;
  nightBagKg: number;
  notes: string | null;
};

// Two-button 40 kg / 50 kg picker; submits as "bagKg". Nothing is pre-selected
// on a new entry — the user must choose a size (native required radio, and the
// server rejects a missing size too). Records from before bag sizes existed
// are stored as 40 kg. Exported for the sale forms so both screens match.
export function BagSizeToggle({
  value,
  onChange,
  name = "bagKg",
}: {
  value: string;
  onChange: (v: string) => void;
  name?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Bag size" className="grid grid-cols-2 gap-2">
      {BAG_SIZES.map((size) => {
        const selected = value === String(size);
        return (
          <label
            key={size}
            className={
              "relative cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green-600 " +
              (selected
                ? "border-green-700 bg-green-700 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:border-green-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300")
            }
          >
            <input
              type="radio"
              name={name}
              value={size}
              required
              checked={selected}
              onChange={() => onChange(String(size))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            {size} kg
          </label>
        );
      })}
    </div>
  );
}

// "120 bags × 50 kg = 6,000 kg" under the bag count, once a count is typed.
export function KgHint({ bags, bagKg }: { bags: string; bagKg: string }) {
  const n = parseFloat(bags);
  if (isNaN(n) || n <= 0) return null;
  if (!bagKg)
    return (
      <p className="mt-1 text-[11px] text-amber-600">Select a bag size (40 or 50 kg).</p>
    );
  return (
    <p className="mt-1 text-[11px] text-neutral-500">
      {n} bags × {bagKg} kg = {(n * Number(bagKg)).toLocaleString()} kg
    </p>
  );
}

// Size to pre-select when editing a shift: its stored size if that shift was
// already entered, otherwise blank so the user has to choose.
function storedSize(row: ProductionDayRow, shift: "DAY" | "NIGHT"): string {
  return shift === "DAY"
    ? row.dayShiftBags > 0 ? String(row.dayBagKg) : ""
    : row.nightShiftBags > 0 ? String(row.nightBagKg) : "";
}

const SHIFT_OPTIONS = [
  { value: "DAY", label: "Day Shift" },
  { value: "NIGHT", label: "Night Shift" },
];

// One entry per shift: pick Day or Night, enter the bags for that shift.
// Saving only touches the selected shift's column for that date.
export function ProductionForm({
  existing,
  defaultMonth,
}: {
  existing?: ProductionDayRow;
  defaultMonth?: string; // YYYY-MM
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    upsertProductionDay,
    {}
  );
  const [shift, setShift] = useState<"DAY" | "NIGHT">("DAY");
  const [bags, setBags] = useState(
    existing ? String(existing.dayShiftBags) : ""
  );
  const [bagKg, setBagKg] = useState(
    existing ? storedSize(existing, "DAY") : ""
  );
  const [formKey, setFormKey] = useState(0);

  // After a successful save on the add form, clear everything for the next
  // entry; remounting via key resets the uncontrolled fields too.
  useEffect(() => {
    if (!state.ok || existing) return;
    setShift("DAY");
    setBags("");
    setBagKg("");
    setFormKey((k) => k + 1);
  }, [state, existing]);

  const onShiftChange = (v: string) => {
    const s = v === "NIGHT" ? "NIGHT" : "DAY";
    setShift(s);
    if (existing) {
      setBags(
        String(s === "DAY" ? existing.dayShiftBags : existing.nightShiftBags)
      );
      setBagKg(storedSize(existing, s));
    }
  };

  return (
    <form key={formKey} action={action} className="grid gap-3 sm:grid-cols-2">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Date
        </label>
        <DateInput
          name="date"
          required
          defaultValue={existing?.date ?? ""}
          fallbackMonth={defaultMonth}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Shift
        </label>
        <SearchableSelect
          name="shift"
          required
          placeholder="Select shift…"
          value={shift}
          onChange={onShiftChange}
          options={SHIFT_OPTIONS}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Bag Size
        </label>
        <BagSizeToggle value={bagKg} onChange={setBagKg} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Bags Produced
        </label>
        <input
          name="bags"
          type="number"
          step="0.5"
          min="0"
          placeholder="0"
          required
          value={bags}
          onChange={(e) => setBags(e.target.value)}
          className={input}
        />
        <KgHint bags={bags} bagKg={bagKg} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Notes (optional)
        </label>
        <input
          name="notes"
          type="text"
          placeholder="Any notes…"
          defaultValue={existing?.notes ?? ""}
          className={input}
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label={existing ? "Update" : "Add Entry"} />
        {state.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
        {state.ok && (
          <span className="text-sm text-green-700">{state.ok}</span>
        )}
      </div>
    </form>
  );
}
