import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  currentMonthParam,
  formatDateRangeLabel,
  formatMonth,
  formatPKR,
} from "@/lib/format";
import { BAG_KG } from "@/lib/constants";
import { DeleteButton } from "@/components/delete-button";
import { EditDialog } from "@/components/edit-dialog";
import { UpsertElectricityForm } from "./electricity-forms";
import { deleteElectricityBill } from "./actions";

function billToMonthStr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Production window a bill covers: the 18th of the previous month through the
 * 17th of the billing month (meter reading dates), not the calendar month. So
 * the August 2026 bill is matched against 18 Jul – 17 Aug 2026 production.
 */
function billingProductionRange(month: Date): { gte: Date; lte: Date } {
  const y = month.getUTCFullYear();
  const m = month.getUTCMonth();
  return {
    gte: new Date(Date.UTC(y, m - 1, 18)),
    lte: new Date(Date.UTC(y, m, 17)),
  };
}

export default async function ElectricityPage() {
  await requireAdmin();

  const bills = await prisma.electricityBill.findMany({
    orderBy: { month: "desc" },
  });

  // Production for every billing window in one query, summed per bill below.
  const ranges = bills.map((b) => billingProductionRange(b.month));
  const productionDays = ranges.length
    ? await prisma.productionDay.findMany({
        where: {
          date: {
            gte: new Date(Math.min(...ranges.map((r) => r.gte.getTime()))),
            lte: new Date(Math.max(...ranges.map((r) => r.lte.getTime()))),
          },
        },
        select: { date: true, dayShiftBags: true, nightShiftBags: true },
      })
    : [];

  const rows = bills.map((b, i) => {
    const range = ranges[i];
    const bags = productionDays
      .filter((d) => d.date >= range.gte && d.date <= range.lte)
      .reduce(
        (sum, d) => sum + d.dayShiftBags.toNumber() + d.nightShiftBags.toNumber(),
        0
      );
    const productionKg = bags * BAG_KG;
    const billAmount = b.billAmount.toNumber();
    return {
      id: b.id,
      month: billToMonthStr(b.month),
      billAmount,
      unitsConsumed: b.unitsConsumed.toNumber(),
      pricePerUnit:
        b.unitsConsumed.toNumber() > 0
          ? billAmount / b.unitsConsumed.toNumber()
          : 0,
      productionKg,
      periodLabel: formatDateRangeLabel(range.gte, range.lte),
      costPerKg: productionKg > 0 ? billAmount / productionKg : null,
    };
  });

  const defaultMonth = currentMonthParam();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Electricity Bills
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          One bill per month — add or update below. Cost/KG uses production
          from the 18th of the previous month to the 17th of the billing month.
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
                <th className="px-4 py-3 font-medium text-right">
                  Production (KG)
                </th>
                <th className="px-4 py-3 font-medium text-right">Cost/KG</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
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
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {row.productionKg.toLocaleString("en-PK", {
                      maximumFractionDigits: 0,
                    })}
                    <div className="text-xs font-normal text-neutral-400">
                      {row.periodLabel}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {row.costPerKg === null ? (
                      <span className="font-normal text-neutral-400">—</span>
                    ) : (
                      formatPKR(row.costPerKg)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <EditDialog title="Edit Bill">
                        <UpsertElectricityForm existing={row} />
                      </EditDialog>
                      <form action={deleteElectricityBill}>
                        <input type="hidden" name="id" value={row.id} />
                        <DeleteButton confirmMessage="Delete this bill?" />
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
