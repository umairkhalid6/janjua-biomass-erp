"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createPurchase, updatePurchase, type ActionState } from "./actions";
import { createSupplier } from "@/app/(app)/suppliers/actions";
import { MATERIAL_LABELS } from "@/lib/constants";
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

type SupplierOption = { id: string; name: string };

type PurchaseRow = {
  id: string;
  date: string;
  materialType: string;
  supplierId: string;
  weightKg: number;
  materialCost: number;
  handlingCost: number;
  notes: string | null;
};

// Calls the server action directly instead of rendering a nested <form>.
// Nested forms are invalid HTML — the browser strips the inner tag, so the
// old Add button silently tried to submit the outer purchase form and did nothing.
function QuickAddSupplier({
  onAdded,
}: {
  onAdded: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-green-700 underline dark:text-green-400"
      >
        + Quick add supplier
      </button>
    );
  }

  const submit = () => {
    if (!name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", name);
      fd.set("phone", phone);
      fd.set("notes", notes);
      const res = await createSupplier({}, fd);
      if (res.error) {
        setError(res.error);
      } else if (res.id) {
        onAdded(res.id, name.trim());
        setName("");
        setPhone("");
        setNotes("");
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
        Quick add supplier
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
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={onEnter}
          className={input}
        />
        <input
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
            {pending ? "Adding…" : "Add Supplier"}
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

const METHODS = ["Cash", "Bank", "Cheque", "Online"];

function formatRate(n: number) {
  return `Rs ${n.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function PurchaseForm({
  existing,
  suppliers,
  submitLabel,
  action,
  state,
}: {
  existing?: PurchaseRow;
  suppliers: SupplierOption[];
  submitLabel: string;
  action: (formData: FormData) => void;
  state: ActionState;
}) {
  const [localSuppliers, setLocalSuppliers] = useState(suppliers);
  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? "");
  const [weight, setWeight] = useState(
    existing ? String(existing.weightKg) : ""
  );
  const [materialCost, setMaterialCost] = useState(
    existing ? String(existing.materialCost) : ""
  );
  const [handlingCost, setHandlingCost] = useState(
    existing ? String(existing.handlingCost) : ""
  );
  const [paymentStatus, setPaymentStatus] = useState<"UNPAID" | "PAID">(
    "PAID"
  );
  const [formKey, setFormKey] = useState(0);

  // After a successful save on the create form, clear everything for the
  // next entry. Bumping the form key remounts the uncontrolled fields too —
  // date back to today, material back to its default.
  useEffect(() => {
    if (!state.ok || existing) return;
    setSupplierId("");
    setWeight("");
    setMaterialCost("");
    setHandlingCost("");
    setPaymentStatus("PAID");
    setFormKey((k) => k + 1);
  }, [state, existing]);

  const w = parseFloat(weight);
  const mc = parseFloat(materialCost);
  const hc = parseFloat(handlingCost || "0");
  const total = !isNaN(mc) ? mc + (isNaN(hc) ? 0 : hc) : 0;
  const ratePerKg = w > 0 && !isNaN(mc) ? total / w : null;

  return (
    <form key={formKey} action={action} className="grid gap-3 sm:grid-cols-2">
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
          Material
        </label>
        <SearchableSelect
          name="materialType"
          required
          placeholder="Search material…"
          defaultValue={existing?.materialType ?? "POPLAR"}
          options={Object.entries(MATERIAL_LABELS).map(([k, v]) => ({
            value: k,
            label: v,
          }))}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
          Supplier
        </label>
        <SearchableSelect
          name="supplierId"
          required
          placeholder="Search supplier…"
          value={supplierId}
          onChange={setSupplierId}
          options={localSuppliers.map((v) => ({ value: v.id, label: v.name }))}
        />
      </div>
      <div className="sm:col-span-2">
        <QuickAddSupplier
          onAdded={(id, name) => {
            setLocalSuppliers((prev) => [...prev, { id, name }]);
            setSupplierId(id);
          }}
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
          placeholder="0"
          required
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
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
          placeholder="0.00"
          required
          value={materialCost}
          onChange={(e) => setMaterialCost(e.target.value)}
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
          placeholder="0"
          value={handlingCost}
          onChange={(e) => setHandlingCost(e.target.value)}
          className={input}
        />
        <p className="mt-1 text-[11px] text-neutral-400">
          Your own unloading/gari expense — not payable to the supplier.
        </p>
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
      <div className="sm:col-span-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800">
        <span className="text-neutral-500">Cost per kg (auto): </span>
        <span className="font-semibold text-neutral-900 dark:text-neutral-50">
          {ratePerKg !== null ? `${formatRate(ratePerKg)}/kg` : "—"}
        </span>
        <span className="ml-2 text-xs text-neutral-400">
          (Material + Handling) ÷ Weight
        </span>
        {!isNaN(mc) && mc > 0 && (
          <p className="mt-1 text-xs text-neutral-500">
            Payable to supplier:{" "}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {formatRate(mc)}
            </span>{" "}
            (material only)
          </p>
        )}
      </div>
      {!existing && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Payment Status
            </label>
            <select
              name="paymentStatus"
              value={paymentStatus}
              onChange={(e) =>
                setPaymentStatus(e.target.value as "UNPAID" | "PAID")
              }
              className={input}
            >
              <option value="PAID">
                Paid in full
                {!isNaN(mc) && mc > 0 ? ` — ${formatRate(mc)} (material)` : ""}
              </option>
              <option value="UNPAID">Unpaid / partial — on balance</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Payment Method
            </label>
            <select name="paymentMethod" defaultValue="Cash" className={input}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {paymentStatus === "UNPAID" && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Amount paid now (PKR, optional)
              </label>
              <input
                name="amountPaid"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className={input}
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Leave empty if nothing was paid — the material cost goes on the
                supplier&apos;s balance. Enter a smaller amount for a partial
                payment. Handling cost is never owed to the supplier.
              </p>
            </div>
          )}
        </>
      )}
      <div className="sm:col-span-2 flex items-center gap-3">
        <Submit label={submitLabel} />
        {state.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
        {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      </div>
    </form>
  );
}

export function CreatePurchaseForm({ suppliers }: { suppliers: SupplierOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(
    createPurchase,
    {}
  );
  return (
    <PurchaseForm
      suppliers={suppliers}
      submitLabel="Record Purchase"
      action={action}
      state={state}
    />
  );
}

export function EditPurchaseForm({
  existing,
  suppliers,
}: {
  existing: PurchaseRow;
  suppliers: SupplierOption[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updatePurchase,
    {}
  );
  return (
    <PurchaseForm
      existing={existing}
      suppliers={suppliers}
      submitLabel="Update"
      action={action}
      state={state}
    />
  );
}
