"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createSale, updateSale, type ActionState } from "./actions";
import { createCustomer, type ActionState as CustomerActionState } from "@/app/(app)/customers/actions";

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

type CustomerOption = { id: string; name: string; company: string | null };

type SaleRow = {
  id: string;
  date: string;
  customerId: string;
  quantityBags: number;
  ratePerBag: number;
  notes: string | null;
};

function QuickAddCustomer({
  onAdded,
}: {
  onAdded: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<CustomerActionState, FormData>(
    createCustomer,
    {}
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-green-700 underline dark:text-green-400"
      >
        + Quick add customer
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
      <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Quick add customer
      </p>
      <form action={action} className="grid gap-2 sm:grid-cols-3">
        <input name="name" placeholder="Name" required className={input} />
        <input name="company" placeholder="Company" className={input} />
        <input name="phone" placeholder="Phone" className={input} />
        <div className="sm:col-span-3 flex items-center gap-2">
          <Submit label="Add" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-neutral-500 underline"
          >
            Cancel
          </button>
          {state.error && (
            <span className="text-xs text-red-600">{state.error}</span>
          )}
          {state.ok && (
            <span className="text-xs text-green-700">{state.ok}</span>
          )}
        </div>
      </form>
    </div>
  );
}

export function CreateSaleForm({
  customers,
}: {
  customers: CustomerOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(createSale, {});
  const [localCustomers, setLocalCustomers] = useState(customers);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Date
        </label>
        <input name="date" type="date" required className={input} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Customer
        </label>
        <select name="customerId" required className={input}>
          <option value="">Select customer…</option>
          {localCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.company ? ` — ${c.company}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <QuickAddCustomer
          onAdded={(id, name) =>
            setLocalCustomers((prev) => [...prev, { id, name, company: null }])
          }
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Quantity (bags)
        </label>
        <input
          name="quantityBags"
          type="number"
          step="0.5"
          min="0.5"
          placeholder="0"
          required
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Rate per bag (PKR)
        </label>
        <input
          name="ratePerBag"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          required
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
          className={input}
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label="Record Sale" />
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

export function EditSaleForm({
  existing,
  customers,
}: {
  existing: SaleRow;
  customers: CustomerOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateSale, {});

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={existing.id} />
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Date
        </label>
        <input
          name="date"
          type="date"
          required
          defaultValue={existing.date}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Customer
        </label>
        <select name="customerId" required defaultValue={existing.customerId} className={input}>
          <option value="">Select customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.company ? ` — ${c.company}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Quantity (bags)
        </label>
        <input
          name="quantityBags"
          type="number"
          step="0.5"
          min="0.5"
          required
          defaultValue={existing.quantityBags}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Rate per bag (PKR)
        </label>
        <input
          name="ratePerBag"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={existing.ratePerBag}
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
          defaultValue={existing.notes ?? ""}
          className={input}
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label="Update Sale" />
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
