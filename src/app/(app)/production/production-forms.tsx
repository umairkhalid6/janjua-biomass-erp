"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { upsertProductionDay, type ActionState } from "./actions";
import { toDateInputValue } from "@/lib/format";

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

export function ProductionForm({
  existing,
  defaultDate,
}: {
  existing?: ProductionDayRow;
  defaultDate?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    upsertProductionDay,
    {}
  );

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Date
        </label>
        <input
          name="date"
          type="date"
          required
          defaultValue={existing ? existing.date : defaultDate ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Day Shift Bags
        </label>
        <input
          name="dayShiftBags"
          type="number"
          step="0.5"
          min="0"
          placeholder="0"
          defaultValue={existing?.dayShiftBags ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Night Shift Bags
        </label>
        <input
          name="nightShiftBags"
          type="number"
          step="0.5"
          min="0"
          placeholder="0"
          defaultValue={existing?.nightShiftBags ?? ""}
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
