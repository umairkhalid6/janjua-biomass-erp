import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { currentMonthParam, formatMonth, formatPKR } from "@/lib/format";
import { UpsertElectricityForm } from "./electricity-forms";
import { deleteElectricityBill } from "./actions";

function billToMonthStr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default async function ElectricityPage() {
  await requireUser();

  const bills = await prisma.electricityBill.findMany({
    orderBy: { month: "desc" },
  });

  const rows = bills.map((b) => ({
    id: b.id,
    month: billToMonthStr(b.month),
    billAmount: b.billAmount.toNumber(),
    unitsConsumed: b.unitsConsumed.toNumber(),
    pricePerUnit:
      b.unitsConsumed.toNumber() > 0
        ? b.billAmount.toNumber() / b.unitsConsumed.toNumber()
        : 0,
  }));

  const defaultMonth = currentMonthParam();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Electricity Bills
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          One bill per month — add or update below.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Add / Update Bill
        </h2>
        <UpsertElectricityForm defaultMonth={defaultMonth} />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium text-right">Bill Amount</th>
                <th className="px-4 py-3 font-medium text-right">Units (kWh)</th>
                <th className="px-4 py-3 font-medium text-right">Price/Unit</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    No bills recorded yet.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    {formatMonth(row.month)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(row.billAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {row.unitsConsumed.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-500">
                    {formatPKR(row.pricePerUnit)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <details className="relative">
                        <summary className="list-none cursor-pointer rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800">
                          Edit
                        </summary>
                        <div className="absolute left-0 top-8 z-10 w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                          <UpsertElectricityForm existing={row} />
                        </div>
                      </details>
                      <form action={deleteElectricityBill}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                          onClick={(e) => {
                            if (!confirm("Delete this bill?")) e.preventDefault();
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
