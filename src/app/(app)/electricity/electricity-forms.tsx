"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { upsertElectricityBill, type ActionState } from "./actions";

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

type BillRow = {
  id: string;
  month: string; // YYYY-MM
  billAmount: number;
  unitsConsumed: number;
};

export function UpsertElectricityForm({
  existing,
  defaultMonth,
}: {
  existing?: BillRow;
  defaultMonth?: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    upsertElectricityBill,
    {}
  );
  const [formKey, setFormKey] = useState(0);

  // After a successful save on the add form, clear the fields for the next
  // entry; remounting via key restores the default month.
  useEffect(() => {
    if (!state.ok || existing) return;
    setFormKey((k) => k + 1);
  }, [state, existing]);

  return (
    <form key={formKey} action={action} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Month
        </label>
        <input
          name="month"
          type="month"
          required
          defaultValue={existing?.month ?? defaultMonth ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Bill Amount (PKR)
        </label>
        <input
          name="billAmount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          required
          defaultValue={existing?.billAmount ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Units Consumed (kWh)
        </label>
        <input
          name="unitsConsumed"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0"
          required
          defaultValue={existing?.unitsConsumed ?? ""}
          className={input}
        />
      </div>
      <div className="sm:col-span-3 flex items-center gap-3">
        <Submit label={existing ? "Update Bill" : "Save Bill"} />
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
