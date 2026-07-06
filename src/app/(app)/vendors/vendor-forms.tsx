"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createVendor, updateVendor, type ActionState } from "./actions";

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

type VendorRow = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
};

function VendorFields({ existing }: { existing?: VendorRow }) {
  return (
    <>
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <input
        name="name"
        placeholder="Vendor name"
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
    </>
  );
}

export function CreateVendorForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    createVendor,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <VendorFields />
      <div className="sm:col-span-3 flex items-center gap-3">
        <Submit label="Add Vendor" />
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

export function EditVendorForm({ existing }: { existing: VendorRow }) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateVendor,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <VendorFields existing={existing} />
      <div className="sm:col-span-3 flex items-center gap-3">
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
