"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCustomer,
  updateCustomer,
  createCustomerPayment,
  updateCustomerPayment,
  type ActionState,
} from "./actions";
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

type CustomerRow = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  openingBalance?: number;
};

function CustomerFields({ existing }: { existing?: CustomerRow }) {
  return (
    <>
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <input
        name="name"
        placeholder="Customer name"
        required
        defaultValue={existing?.name ?? ""}
        className={input}
      />
      <input
        name="company"
        placeholder="Company (optional)"
        defaultValue={existing?.company ?? ""}
        className={input}
      />
      <input
        name="phone"
        placeholder="Phone (optional)"
        defaultValue={existing?.phone ?? ""}
        className={input}
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Opening Balance (PKR)
        </label>
        <input
          name="openingBalance"
          type="number"
          step="0.01"
          min="0"
          defaultValue={Math.abs(existing?.openingBalance ?? 0)}
          placeholder="0.00"
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Opening Balance Type
        </label>
        <select
          name="openingBalanceType"
          defaultValue={(existing?.openingBalance ?? 0) < 0 ? "CR" : "DR"}
          className={input}
        >
          <option value="DR">Customer owes us — outstanding (Dr)</option>
          <option value="CR">Customer paid in advance — credit (Cr)</option>
        </select>
      </div>
    </>
  );
}

export function CreateCustomerForm({
  onSuccess,
}: {
  onSuccess?: (id: string, name: string) => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createCustomer,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <CustomerFields />
      <div className="sm:col-span-4 flex items-center gap-3">
        <Submit label="Add Customer" />
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

export function EditCustomerForm({ existing }: { existing: CustomerRow }) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateCustomer,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <CustomerFields existing={existing} />
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

const METHODS = ["Cash", "Bank", "Cheque", "Online"];

export function CustomerPaymentForm({ customerId }: { customerId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    createCustomerPayment,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="customerId" value={customerId} />
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Date
        </label>
        <DateInput name="date" required className={input} />
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
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Method
        </label>
        <select name="method" defaultValue="Cash" className={input}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
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
        <Submit label="Record Payment" />
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

export type PaymentRow = {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  method: string;
  notes: string | null;
};

export function EditCustomerPaymentForm({ existing }: { existing: PaymentRow }) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateCustomerPayment,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={existing.id} />
      <input type="hidden" name="customerId" value={existing.customerId} />
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
          Amount (PKR)
        </label>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={existing.amount}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Method
        </label>
        <select name="method" defaultValue={existing.method} className={input}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
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
        <Submit label="Update Payment" />
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
