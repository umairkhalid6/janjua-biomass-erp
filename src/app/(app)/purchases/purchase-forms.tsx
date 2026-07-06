"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPurchase, updatePurchase, type ActionState } from "./actions";
import { createVendor, type ActionState as VendorActionState } from "@/app/(app)/vendors/actions";
import { MATERIAL_LABELS } from "@/lib/constants";

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

type VendorOption = { id: string; name: string };

type PurchaseRow = {
  id: string;
  date: string;
  materialType: string;
  vendorId: string;
  weightKg: number;
  materialCost: number;
  handlingCost: number;
  notes: string | null;
};

function QuickAddVendor({
  onAdded,
}: {
  onAdded: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<VendorActionState, FormData>(
    createVendor,
    {}
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-green-700 underline dark:text-green-400"
      >
        + Quick add vendor
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
      <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
        Quick add vendor
      </p>
      <form action={action} className="grid gap-2 sm:grid-cols-3">
        <input name="name" placeholder="Name" required className={input} />
        <input name="phone" placeholder="Phone" className={input} />
        <input name="notes" placeholder="Notes" className={input} />
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

function PurchaseFields({
  existing,
  vendors,
}: {
  existing?: PurchaseRow;
  vendors: VendorOption[];
}) {
  const [localVendors, setLocalVendors] = useState(vendors);

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
          Material
        </label>
        <select
          name="materialType"
          required
          defaultValue={existing?.materialType ?? "POPLAR"}
          className={input}
        >
          {Object.entries(MATERIAL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Vendor
        </label>
        <select
          name="vendorId"
          required
          defaultValue={existing?.vendorId ?? ""}
          className={input}
        >
          <option value="">Select vendor…</option>
          {localVendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <QuickAddVendor
          onAdded={(id, name) =>
            setLocalVendors((prev) => [...prev, { id, name }])
          }
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Weight (kg)
        </label>
        <input
          name="weightKg"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={existing?.weightKg ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Material Cost (PKR)
        </label>
        <input
          name="materialCost"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={existing?.materialCost ?? ""}
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Handling Cost (PKR)
        </label>
        <input
          name="handlingCost"
          type="number"
          step="0.01"
          min="0"
          defaultValue={existing?.handlingCost ?? "0"}
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
    </>
  );
}

export function CreatePurchaseForm({ vendors }: { vendors: VendorOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(
    createPurchase,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <PurchaseFields vendors={vendors} />
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label="Record Purchase" />
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

export function EditPurchaseForm({
  existing,
  vendors,
}: {
  existing: PurchaseRow;
  vendors: VendorOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updatePurchase,
    {}
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <PurchaseFields existing={existing} vendors={vendors} />
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
