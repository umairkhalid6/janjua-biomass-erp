"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createSupplier,
  updateSupplier,
  createSupplierPayment,
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

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  openingBalance?: number;
};

function SupplierFields({ existing }: { existing?: SupplierRow }) {
  return (
    <>
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <input
        name="name"
        placeholder="Supplier name"
        required
        defaultValue={existing?.name ?? ""}
        className={input}
      />
      <input
        name="phone"
        placeholder="Phone (optional)"
        defaultValue={existing?.phone ?? ""}
        className={input}
      />
      <input
        name="notes"
        placeholder="Notes (optional)"
        defaultValue={existing?.notes ?? ""}
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
          defaultValue={existing ? existing.openingBalance ?? 0 : undefined}
          placeholder="0.00"
          className={input}
        />
      </div>
    </>
  );
}

export function CreateSupplierForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    createSupplier,
    {}
  );
  const [formKey, setFormKey] = useState(0);

  // Clear the form after a successful save so the next supplier can be
  // entered right away; remounting via key resets the uncontrolled fields.
  useEffect(() => {
    if (state.ok) setFormKey((k) => k + 1);
  }, [state]);

  return (
    <form key={formKey} action={action} className="grid gap-3 sm:grid-cols-4">
      <SupplierFields />
      <div className="sm:col-span-4 flex items-center gap-3">
        <Submit label="Add Supplier" />
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

export function EditSupplierForm({ existing }: { existing: SupplierRow }) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateSupplier,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <SupplierFields existing={existing} />
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

type PurchaseOption = { id: string; label: string };

export function SupplierPaymentForm({
  supplierId,
  purchases = [],
}: {
  supplierId: string;
  purchases?: PurchaseOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createSupplierPayment,
    {}
  );
  const [formKey, setFormKey] = useState(0);

  // Clear the form after a successful save; remounting via key resets the
  // uncontrolled fields and puts the date back to today.
  useEffect(() => {
    if (state.ok) setFormKey((k) => k + 1);
  }, [state]);

  return (
    <form key={formKey} action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="supplierId" value={supplierId} />
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
          placeholder="0.00"
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
          Apply to (optional)
        </label>
        <select name="purchaseId" defaultValue="" className={input}>
          <option value="">General payment (advance / previous balance)</option>
          {purchases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
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
