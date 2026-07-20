"use client";

// Screen-only panel on the invoice page: record money received against THIS
// invoice before printing/sharing, so the generated image shows "Amount
// Received" and the true balance due. Hidden from print and image capture.

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  recordInvoicePayment,
  deleteInvoicePayment,
  type ActionState,
} from "@/app/(app)/sales/actions";
import { DateInput } from "@/components/date-input";
import { formatDate, formatPKR } from "@/lib/format";

const input =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600";

type PaymentRow = {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  method: string;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Record Payment"}
    </button>
  );
}

export function RecordPaymentPanel({
  saleId,
  payments,
  previousBalance,
  totalPayable,
  balanceDue,
}: {
  saleId: string;
  payments: PaymentRow[];
  previousBalance: number;
  totalPayable: number;
  balanceDue: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    recordInvoicePayment,
    {}
  );
  const [formKey, setFormKey] = useState(0);

  // Clear the form after a successful save; remounting via key resets the
  // uncontrolled fields and puts the date back to today.
  useEffect(() => {
    if (state.ok) setFormKey((k) => k + 1);
  }, [state]);

  return (
    <section className="print:hidden border-b border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">
            Payment against this invoice
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {previousBalance > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                Previous balance: {formatPKR(previousBalance)}
              </span>
            )}
            <span className="rounded-full bg-neutral-200 px-2.5 py-1 font-medium text-neutral-700">
              Total payable: {formatPKR(totalPayable)}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${
                balanceDue > 0.005
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {balanceDue > 0.005
                ? `Balance due: ${formatPKR(balanceDue)}`
                : "Settled"}
            </span>
          </div>
        </div>

        {payments.length > 0 && (
          <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white text-sm">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="text-neutral-600">
                  {formatDate(p.date)} · {p.method}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-emerald-700">
                    {formatPKR(p.amount)}
                  </span>
                  <form action={deleteInvoicePayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="saleId" value={saleId} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 underline hover:text-red-700"
                    >
                      Remove
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form key={formKey} action={action} className="mt-3 grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="saleId" value={saleId} />
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Amount received (PKR)
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
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Method
            </label>
            <select name="method" className={input} defaultValue="Cash">
              <option>Cash</option>
              <option>Bank</option>
              <option>Cheque</option>
              <option>Online</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Date
            </label>
            <DateInput name="date" required className={input} />
          </div>
          <div className="flex items-end">
            <Submit />
          </div>
          {state.error && (
            <p className="sm:col-span-4 text-sm text-red-600">{state.error}</p>
          )}
          {state.ok && (
            <p className="sm:col-span-4 text-sm text-green-700">{state.ok}</p>
          )}
        </form>
      </div>
    </section>
  );
}
