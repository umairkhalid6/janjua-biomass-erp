"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { upsertProductionDay, type ActionState } from "./actions";
import { SearchableSelect } from "@/components/searchable-select";
import { DateInput } from "@/components/date-input";

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
  notes: string | null;
};

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

  const onShiftChange = (v: string) => {
    const s = v === "NIGHT" ? "NIGHT" : "DAY";
    setShift(s);
    if (existing) {
      setBags(
        String(s === "DAY" ? existing.dayShiftBags : existing.nightShiftBags)
      );
    }
  };

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
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
      <div className="sm:col-span-2">
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
