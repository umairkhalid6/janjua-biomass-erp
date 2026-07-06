"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createExpense, updateExpense, type ActionState } from "./actions";

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
        <input
          name="date"
          type="date"
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
          required
          defaultValue={existing?.amount ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Category
        </label>
        <input
          name="category"
          type="text"
          list="category-list"
          placeholder="Maintenance"
          defaultValue={existing?.category ?? "Maintenance"}
          className={input}
        />
        <datalist id="category-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
    </>
  );
}

export function CreateExpenseForm({ categories }: { categories: string[] }) {
  const [state, action] = useActionState<ActionState, FormData>(
    createExpense,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <ExpenseFields categories={categories} />
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label="Add Expense" />
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

export function EditExpenseForm({
  existing,
  categories,
}: {
  existing: ExpenseRow;
  categories: string[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateExpense,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <ExpenseFields existing={existing} categories={categories} />
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label="Update" />
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
