"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createContractorRate, type ActionState } from "./actions";
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

export function AddContractorRateForm({
  currentDayRate,
  currentNightRate,
}: {
  currentDayRate?: number;
  currentNightRate?: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createContractorRate,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Effective From
        </label>
        <DateInput
          name="effectiveFrom"
          required
          className={input}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Today or later — past production keeps its old rate.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Day shift rate / kg (PKR)
        </label>
        <input
          name="dayRatePerKg"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={currentDayRate}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Night shift rate / kg (PKR)
        </label>
        <input
          name="nightRatePerKg"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={currentNightRate}
          className={input}
        />
      </div>
      <div className="sm:col-span-3 flex items-center gap-3">
        <Submit label="Add Rate" />
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
