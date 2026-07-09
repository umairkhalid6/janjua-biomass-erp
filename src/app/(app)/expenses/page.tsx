import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  currentMonthParam,
  formatDate,
  formatMonth,
  formatPKR,
  monthRange,
  toDateInputValue,
} from "@/lib/format";
import { paginate, parseNumberParam } from "@/lib/pagination";
import { MonthPicker } from "@/components/month-picker";
import { DeleteButton } from "@/components/delete-button";
import { EditDialog } from "@/components/edit-dialog";
import { Pagination } from "@/components/pagination";
import {
  FilterRange,
  FilterSearch,
  FilterSelect,
  ResetFilters,
} from "@/components/table-filters";
import { CreateExpenseForm, EditExpenseForm } from "./expense-forms";
import { deleteExpense } from "./actions";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    category?: string;
    q?: string;
    min?: string;
    max?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.month ?? currentMonthParam();
  const { gte, lte } = monthRange(month);

  const category = sp.category ?? null;
  const itemQuery = sp.q?.trim().toLowerCase() ?? "";
  const minAmount = parseNumberParam(sp.min);
  const maxAmount = parseNumberParam(sp.max);
  const hasFilters = Boolean(
    category || itemQuery || minAmount !== null || maxAmount !== null
  );

  const [expenses, allCategories] = await Promise.all([
    prisma.expense.findMany({
      where: { date: { gte, lte } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.expense.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  const rows = expenses.map((e) => ({
    id: e.id,
    date: toDateInputValue(e.date),
    item: e.item,
    amount: e.amount.toNumber(),
    category: e.category,
  }));

  const filtered = rows.filter(
    (r) =>
      (!category || r.category === category) &&
      (!itemQuery || r.item.toLowerCase().includes(itemQuery)) &&
      (minAmount === null || r.amount >= minAmount) &&
      (maxAmount === null || r.amount <= maxAmount)
  );

  const categories = allCategories.map((c) => c.category);
  // Total covers every filtered row, not just the visible page.
  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);

  const { page, pageCount, total, pageRows } = paginate(filtered, sp.page);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Expenses
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {formatMonth(month)}
          </p>
        </div>
        <Suspense>
          <MonthPicker value={month} />
        </Suspense>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Add Expense
        </h2>
        <CreateExpenseForm categories={categories} />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Suspense>
            <FilterSelect
              paramName="category"
              value={category ?? ""}
              options={categories.map((c) => ({ value: c, label: c }))}
              allLabel="All categories"
            />
            <FilterSearch
              paramName="q"
              value={sp.q ?? ""}
              placeholder="Search items"
            />
            <FilterRange
              minParam="min"
              maxParam="max"
              minValue={sp.min}
              maxValue={sp.max}
              placeholder={["Min amount", "Max amount"]}
            />
            {hasFilters && (
              <ResetFilters params={["category", "q", "min", "max"]} />
            )}
          </Suspense>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    {hasFilters
                      ? "No expenses match the current filters."
                      : `No expenses for ${formatMonth(month)}.`}
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr
                  key={row.id}
                  className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    {row.item}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatPKR(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <EditDialog title="Edit Expense">
                        <EditExpenseForm existing={row} categories={categories} />
                      </EditDialog>
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={row.id} />
                        <DeleteButton confirmMessage="Delete this expense?" />
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="border-t-2 border-neutral-300 bg-neutral-50 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-neutral-900 dark:text-neutral-50">
                    {hasFilters ? "Filtered Total" : "Month Total"}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">
                    {formatPKR(totalAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Suspense>
          <Pagination page={page} pageCount={pageCount} total={total} noun="expenses" />
        </Suspense>
      </section>
    </div>
  );
}
