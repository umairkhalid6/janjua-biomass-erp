"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createSale, updateSale, type ActionState } from "./actions";
import { createCustomer } from "@/app/(app)/customers/actions";
import { SearchableSelect } from "@/components/searchable-select";
import { LOADING_CHARGE_PER_BAG } from "@/lib/constants";

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
  // Customer-facing rate (net ratePerBag + loading charge) — what the user
  // originally typed; the server re-splits it on save.
  ratePerBag: number;
  notes: string | null;
};

function RateHint() {
  return (
    <p className="mt-1 text-[11px] text-neutral-400">
      Includes Rs {LOADING_CHARGE_PER_BAG}/bag loading charge (tracked
      separately in records).
    </p>
  );
}

function customerLabel(c: CustomerOption) {
  return `${c.name}${c.company ? ` — ${c.company}` : ""}`;
}

// Calls the server action directly instead of rendering a nested <form>.
// Nested forms are invalid HTML — the browser strips the inner tag, so the
// old Add button silently tried to submit the outer sale form and did nothing.
function QuickAddCustomer({
  onAdded,
}: {
  onAdded: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  const submit = () => {
    if (!name.trim()) {
      setError("Customer name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("company", company);
      fd.set("phone", phone);
      const res = await createCustomer({}, fd);
      if (res.error) {
        setError(res.error);
      } else if (res.id) {
        onAdded(res.id, name.trim());
        setName("");
        setCompany("");
        setPhone("");
        setOpen(false);
      }
    });
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
      <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Quick add customer
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onEnter}
          className={input}
        />
        <input
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onKeyDown={onEnter}
          className={input}
        />
        <input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={onEnter}
          className={input}
        />
        <div className="sm:col-span-3 flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add Customer"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-neutral-500 underline"
          >
            Cancel
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
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
  const [customerId, setCustomerId] = useState("");

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
        <SearchableSelect
          name="customerId"
          required
          placeholder="Search customer…"
          value={customerId}
          onChange={setCustomerId}
          options={localCustomers.map((c) => ({
            value: c.id,
            label: customerLabel(c),
          }))}
        />
      </div>
      <div className="sm:col-span-2">
        <QuickAddCustomer
          onAdded={(id, name) => {
            setLocalCustomers((prev) => [...prev, { id, name, company: null }]);
            setCustomerId(id);
          }}
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
          min={LOADING_CHARGE_PER_BAG + 0.01}
          placeholder="0.00"
          required
          className={input}
        />
        <RateHint />
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
        <SearchableSelect
          name="customerId"
          required
          placeholder="Search customer…"
          defaultValue={existing.customerId}
          options={customers.map((c) => ({
            value: c.id,
            label: customerLabel(c),
          }))}
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
          min={LOADING_CHARGE_PER_BAG + 0.01}
          required
          defaultValue={existing.ratePerBag}
          className={input}
        />
        <RateHint />
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
