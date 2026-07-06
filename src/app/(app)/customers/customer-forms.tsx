"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCustomer, updateCustomer, type ActionState } from "./actions";

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
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <CustomerFields />
      <div className="sm:col-span-3 flex items-center gap-3">
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
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <CustomerFields existing={existing} />
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
