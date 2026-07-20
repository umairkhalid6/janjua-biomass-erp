"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createExpense, updateExpense, type ActionState } from "./actions";
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

type ExpenseRow = {
  id: string;
  date: string;
  item: string;
  amount: number;
  category: string;
};

function ExpenseFields({
  existing,
  categories,
}: {
  existing?: ExpenseRow;
  categories: string[];
}) {
  return (
    <>
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Date
        </label>
        <DateInput
          name="date"
          required
          defaultValue={existing?.date ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Item
        </label>
        <input
          name="item"
          type="text"
          placeholder="Description"
          required
          defaultValue={existing?.item ?? ""}
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
          Category
        </label>
        <SearchableSelect
          name="category"
          required
          allowCustom
          placeholder="Search or add category…"
          defaultValue={existing?.category}
          options={categories.map((c) => ({ value: c, label: c }))}
        />
      </div>
    </>
  );
}

export function CreateExpenseForm({ categories }: { categories: string[] }) {
  const [state, action] = useActionState<ActionState, FormData>(
    createExpense,
    {},
  );
  const [formKey, setFormKey] = useState(0);

  // Clear the form after a successful save; remounting via key resets the
  // uncontrolled fields and puts the date back to today.
  useEffect(() => {
    if (state.ok) setFormKey((k) => k + 1);
  }, [state]);

  return (
    <form key={formKey} action={action} className="grid gap-3 sm:grid-cols-2">
      <ExpenseFields categories={categories} />
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label="Add Expense" />
        {state.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
        {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      </div>
    </form>
  );
}

export function EditExpenseForm({
  existing,
  categories,
}: {
  existing: ExpenseRow;
  categories: string[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateExpense,
    {},
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <ExpenseFields existing={existing} categories={categories} />
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label="Update" />
        {state.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
        {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      </div>
    </form>
  );
}
