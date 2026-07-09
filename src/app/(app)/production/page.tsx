import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import {
  currentMonthParam,
  formatDate,
  formatMonth,
  monthRange,
  toDateInputValue,
} from "@/lib/format";
import { paginate } from "@/lib/pagination";
import { MonthPicker } from "@/components/month-picker";
import { DeleteButton } from "@/components/delete-button";
import { EditDialog } from "@/components/edit-dialog";
import { Pagination } from "@/components/pagination";
import {
  FilterSearch,
  FilterSelect,
  ResetFilters,
} from "@/components/table-filters";
import { ProductionForm } from "./production-forms";
import { EnteredByCell } from "./entered-by-cell";
import { deleteProductionDay } from "./actions";

const SHIFT_OPTIONS = [
  { value: "day", label: "Day shift" },
  { value: "night", label: "Night shift" },
];

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    shift?: string;
    user?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const sp = await searchParams;
  const month = sp.month ?? currentMonthParam();
  const { gte, lte } = monthRange(month);

  const shift = sp.shift === "day" || sp.shift === "night" ? sp.shift : null;
  const userId = sp.user ?? null;
  const notesQuery = sp.q?.trim().toLowerCase() ?? "";
  const hasFilters = Boolean(shift || userId || notesQuery);

  const [rows, users] = await Promise.all([
    prisma.productionDay.findMany({
      where: { date: { gte, lte } },
      orderBy: { date: "desc" },
      include: {
        dayCreatedBy: { select: { name: true } },
        dayUpdatedBy: { select: { name: true } },
        nightCreatedBy: { select: { name: true } },
        nightUpdatedBy: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Serialize Decimals to numbers and flatten the per-shift audit trail.
  const days = rows.map((r) => ({
    id: r.id,
    date: toDateInputValue(r.date),
    dayShiftBags: r.dayShiftBags.toNumber(),
    nightShiftBags: r.nightShiftBags.toNumber(),
    notes: r.notes,
    // Every user id touching this row, for the "entered by" filter.
    auditIds: [
      r.createdById,
      r.updatedById,
      r.dayCreatedById,
      r.dayUpdatedById,
      r.nightCreatedById,
      r.nightUpdatedById,
    ].filter((id): id is string => Boolean(id)),
    dayAudit: {
      createdByName: r.dayCreatedBy?.name ?? null,
      updatedByName: r.dayUpdatedBy?.name ?? null,
      updatedAt: r.dayUpdatedAt?.toISOString() ?? null,
    },
    nightAudit: {
      createdByName: r.nightCreatedBy?.name ?? null,
      updatedByName: r.nightUpdatedBy?.name ?? null,
      updatedAt: r.nightUpdatedAt?.toISOString() ?? null,
    },
  }));

  const filtered = days.filter(
    (r) =>
      (shift !== "day" || r.dayShiftBags > 0) &&
      (shift !== "night" || r.nightShiftBags > 0) &&
      (!userId || r.auditIds.includes(userId)) &&
      (!notesQuery || (r.notes ?? "").toLowerCase().includes(notesQuery))
  );

  // Totals cover every filtered row, not just the visible page.
  const totalDay = filtered.reduce((s, r) => s + r.dayShiftBags, 0);
  const totalNight = filtered.reduce((s, r) => s + r.nightShiftBags, 0);
  const totalBags = totalDay + totalNight;

  const { page, pageCount, total, pageRows } = paginate(filtered, sp.page);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Production Log
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {formatMonth(month)}
          </p>
        </div>
        <Suspense>
          <MonthPicker value={month} />
        </Suspense>
      </div>

      {/* Add / Edit form */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Add / Edit Entry
        </h2>
        <ProductionForm defaultMonth={month} />
      </section>

      {/* Table */}
      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Suspense>
            <FilterSelect
              paramName="shift"
              value={shift ?? ""}
              options={SHIFT_OPTIONS}
              allLabel="All shifts"
            />
            <FilterSelect
              paramName="user"
              value={userId ?? ""}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              allLabel="Entered by anyone"
            />
            <FilterSearch
              paramName="q"
              value={sp.q ?? ""}
              placeholder="Search notes"
            />
            {hasFilters && <ResetFilters params={["shift", "user", "q"]} />}
          </Suspense>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Day Bags</th>
                <th className="px-4 py-3 font-medium text-right">Night Bags</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">Entered By</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    {hasFilters
                      ? "No entries match the current filters."
                      : `No entries for ${formatMonth(month)}.`}
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {row.dayShiftBags.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-700 dark:text-neutral-300">
                    {row.nightShiftBags.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {(row.dayShiftBags + row.nightShiftBags).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {row.notes ?? ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    <EnteredByCell
                      date={formatDate(row.date)}
                      day={row.dayAudit}
                      night={row.nightAudit}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <EditDialog title="Edit Production Entry">
                        <ProductionForm existing={row} />
                      </EditDialog>
                      {isAdmin && (
                        <form action={deleteProductionDay}>
                          <input type="hidden" name="id" value={row.id} />
                          <DeleteButton confirmMessage="Delete this entry?" />
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-50">
                    {hasFilters ? "Filtered Total" : "Month Total"}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totalDay.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-900 dark:text-neutral-50">
                    {totalNight.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {totalBags.toFixed(2)} bags
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Suspense>
          <Pagination page={page} pageCount={pageCount} total={total} noun="days" />
        </Suspense>
      </section>
    </div>
  );
}
