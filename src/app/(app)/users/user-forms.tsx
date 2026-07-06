"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createUser, resetPassword, type ActionState } from "./actions";

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

export function CreateUserForm() {
  const [state, action] = useActionState<ActionState, FormData>(createUser, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input name="name" placeholder="Full name" required className={input} />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className={input}
      />
      <input
        name="password"
        type="password"
        placeholder="Password (6+ chars)"
        required
        className={input}
      />
      <select name="role" defaultValue="OPERATOR" className={input}>
        <option value="OPERATOR">Operator</option>
        <option value="ADMIN">Admin</option>
      </select>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label="Create user" />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      </div>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    resetPassword,
    {}
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="password"
        type="password"
        placeholder="New password"
        required
        className="w-36 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 focus:border-green-600 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50"
      />
      <button
        type="submit"
        className="rounded-lg border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        Reset
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.ok && <span className="text-xs text-green-700">{state.ok}</span>}
    </form>
  );
}
