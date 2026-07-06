import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatDate, toDateInputValue } from "@/lib/format";
import { AddContractorRateForm } from "./settings-forms";

export default async function SettingsPage() {
  await requireAdmin();

  const rates = await prisma.contractorRate.findMany({
    orderBy: { effectiveFrom: "desc" },
  });

  const rows = rates.map((r) => ({
    id: r.id,
    effectiveFrom: toDateInputValue(r.effectiveFrom),
    ratePerKg: r.ratePerKg.toNumber(),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Settings
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Admin-only configuration.
        </p>
      </div>

      {/* Contractor rate history */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Contractor Rate History
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Labor cost = bags × {40} kg/bag × rate. Add a new entry when the rate
          changes; the view uses the rate effective on each production date.
        </p>
        <AddContractorRateForm />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Effective From</th>
                <th className="px-4 py-3 font-medium text-right">Rate / kg (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    No rates configured.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    {formatDate(r.effectiveFrom)}
                    {i === 0 && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-400">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    PKR {r.ratePerKg.toFixed(2)}
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
