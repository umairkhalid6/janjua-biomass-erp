"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCustomInvoice,
  updateCustomInvoice,
  type ActionState,
} from "./actions";
import { DateInput } from "@/components/date-input";
import { BAG_KG } from "@/lib/constants";
import { formatPKR } from "@/lib/format";
import { formatQty, invoiceTotals } from "@/lib/custom-invoice";

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50";
const label =
  "mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400";

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

export type InvoiceFormValues = {
  id: string;
  date: string;
  customerName: string;
  customerAddress: string | null;
  customerPhone: string | null;
  notes: string | null;
  items: {
    description: string;
    quantityBags: number;
    bagSizeKg: number;
    ratePerKg: number;
  }[];
};

// Item rows are kept as strings so half-typed numbers ("12.") aren't mangled.
type Row = {
  key: number;
  description: string;
  quantityBags: string;
  bagSizeKg: string;
  ratePerKg: string;
};

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// React keys for item rows; only needs to be unique, never reset.
let nextKey = 0;
const blankRow = (): Row => ({
  key: nextKey++,
  description: "Biomass Pellets",
  quantityBags: "",
  bagSizeKg: String(BAG_KG),
  ratePerKg: "",
});

function InvoiceFields({ existing }: { existing?: InvoiceFormValues }) {
  const [rows, setRows] = useState<Row[]>(() =>
    existing?.items.length
      ? existing.items.map((it) => ({
          key: nextKey++,
          description: it.description,
          quantityBags: String(it.quantityBags),
          bagSizeKg: String(it.bagSizeKg),
          ratePerKg: String(it.ratePerKg),
        }))
      : [blankRow()]
  );

  const update = (key: number, field: keyof Omit<Row, "key">, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const lines = rows.map((r) => ({
    description: r.description,
    quantityBags: num(r.quantityBags),
    bagSizeKg: num(r.bagSizeKg),
    ratePerKg: num(r.ratePerKg),
  }));
  const totals = invoiceTotals(lines);

  return (
    <>
      {existing && <input type="hidden" name="id" value={existing.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Customer name</label>
          <input
            name="customerName"
            required
            defaultValue={existing?.customerName ?? ""}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Invoice date</label>
          <DateInput
            name="date"
            required
            defaultValue={existing?.date ?? ""}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Customer address</label>
          <textarea
            name="customerAddress"
            rows={2}
            defaultValue={existing?.customerAddress ?? ""}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Customer phone (optional)</label>
          <input
            name="customerPhone"
            type="tel"
            defaultValue={existing?.customerPhone ?? ""}
            className={input}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Items
        </p>
        {rows.map((r, i) => {
          const amount =
            num(r.quantityBags) * num(r.bagSizeKg) * num(r.ratePerKg);
          return (
            <div
              key={r.key}
              className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end dark:border-neutral-800"
            >
              <div className="col-span-2 sm:col-span-1">
                <label className={label}>Description</label>
                <input
                  name="description"
                  value={r.description}
                  onChange={(e) => update(r.key, "description", e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Quantity (bags)</label>
                <input
                  name="quantityBags"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  value={r.quantityBags}
                  onChange={(e) => update(r.key, "quantityBags", e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Bag size (kg)</label>
                <input
                  name="bagSizeKg"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  value={r.bagSizeKg}
                  onChange={(e) => update(r.key, "bagSizeKg", e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Rate per kg (PKR)</label>
                <input
                  name="ratePerKg"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={r.ratePerKg}
                  onChange={(e) => update(r.key, "ratePerKg", e.target.value)}
                  className={input}
                />
              </div>
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                  {formatPKR(amount)}
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                    aria-label={`Remove item ${i + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, blankRow()])}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            + Add item
          </button>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {formatQty(totals.bags)} bags · {formatQty(totals.weightKg)} kg ·{" "}
            <span className="font-bold text-neutral-900 dark:text-neutral-50">
              {formatPKR(totals.amount)}
            </span>
          </p>
        </div>
      </div>

      <div>
        <label className={label}>Notes (optional)</label>
        <textarea
          name="notes"
          rows={2}
          defaultValue={existing?.notes ?? ""}
          className={input}
        />
      </div>
    </>
  );
}

export function CreateInvoiceForm() {
  // On success the action redirects to the new invoice, so only errors return.
  const [state, action] = useActionState<ActionState, FormData>(
    createCustomInvoice,
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <InvoiceFields />
      <div className="flex items-center gap-3">
        <Submit label="Save & View Invoice" />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function EditInvoiceForm({ existing }: { existing: InvoiceFormValues }) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateCustomInvoice,
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <InvoiceFields existing={existing} />
      <div className="flex items-center gap-3">
        <Submit label="Update" />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
      </div>
    </form>
  );
}
