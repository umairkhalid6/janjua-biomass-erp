"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPayment, createAdjustment, type ActionState } from "./actions";
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

type PaymentRow = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  notes: string | null;
};

type AdjustmentRow = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // signed: negative = paying
  reason: string;
};

export function PaymentForm({ existing }: { existing?: PaymentRow }) {
  const [state, action] = useActionState<ActionState, FormData>(
    createPayment,
    {}
  );
  const [formKey, setFormKey] = useState(0);

  // Clear the add form after a successful save; remounting via key resets the
  // uncontrolled fields and puts the date back to today.
  useEffect(() => {
    if (state.ok && !existing) setFormKey((k) => k + 1);
  }, [state, existing]);

  return (
    <form key={formKey} action={action} className="grid gap-3 sm:grid-cols-3">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Date
        </label>
        <DateInput
          name="date"
          required
          defaultValue={existing?.date}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Amount (PKR)
        </label>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          required
          defaultValue={existing?.amount ?? ""}
          className={input}
        />
      </div>
      <div>
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
      <div className="sm:col-span-3 flex items-center gap-3">
        <Submit label={existing ? "Update Payment" : "Record Payment"} />
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

export function AdjustmentForm({ existing }: { existing?: AdjustmentRow }) {
  const [state, action] = useActionState<ActionState, FormData>(
    createAdjustment,
    {}
  );
  const [formKey, setFormKey] = useState(0);

  // Clear the add form after a successful save; remounting via key resets the
  // uncontrolled fields and puts the date back to today.
  useEffect(() => {
    if (state.ok && !existing) setFormKey((k) => k + 1);
  }, [state, existing]);

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
          defaultValue={existing?.date}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Type
        </label>
        <select
          name="direction"
          required
          defaultValue={existing && existing.amount >= 0 ? "receiving" : "paying"}
          className={input}
        >
          <option value="paying">Paying — we pay the contractor</option>
          <option value="receiving">Receiving — contractor pays us</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Amount (PKR)
        </label>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="Amount"
          defaultValue={existing ? Math.abs(existing.amount) : ""}
          className={input}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Reason
        </label>
        <input
          name="reason"
          type="text"
          required
          placeholder="e.g. Opening balance, Correction…"
          defaultValue={existing?.reason ?? ""}
          className={input}
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label={existing ? "Update Adjustment" : "Record Adjustment"} />
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
