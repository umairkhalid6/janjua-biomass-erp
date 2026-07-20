import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatPKR } from "@/lib/format";
import { daysSince } from "@/lib/aging";
import { paginate } from "@/lib/pagination";
import { EditDialog } from "@/components/edit-dialog";
import { AgingBadge } from "@/components/aging-badge";
import { Pagination } from "@/components/pagination";
import {
  FilterSearch,
  FilterSelect,
  ResetFilters,
} from "@/components/table-filters";
import { CreateCustomerForm, EditCustomerForm } from "./customer-forms";
import { DeleteCustomerButton } from "./delete-customer-button";

type CustomerSummaryRow = {
  customer_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  opening_balance: string | number;
  total_sales: string | number;
  sales_count: string | number;
  total_bags: string | number;
  last_sale_date: Date | null;
  total_paid: string | number;
  last_payment_date: Date | null;
  outstanding: string | number;
};

const BALANCE_OPTIONS = [
  { value: "owes", label: "Owes us" },
  { value: "clear", label: "Clear" },
  { value: "credit", label: "Has advance" },
];

const AGING_OPTIONS = [
  { value: "30", label: "Overdue 30+ days" },
  { value: "60", label: "Overdue 60+ days" },
  { value: "90", label: "Overdue 90+ days" },
];

const SORT_OPTIONS = [
  { value: "outstanding", label: "Sort: Outstanding (high → low)" },
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    balance?: string;
    aging?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const query = sp.q?.trim().toLowerCase() ?? "";
  const balance =
    sp.balance === "owes" || sp.balance === "clear" || sp.balance === "credit"
      ? sp.balance
      : null;
  const aging =
    sp.aging === "30" || sp.aging === "60" || sp.aging === "90"
      ? Number(sp.aging)
      : null;
  const sort = sp.sort === "outstanding" ? "outstanding" : "name";
  const hasFilters = Boolean(query || balance || aging !== null);

  const [summaryRows, customers] = await Promise.all([
    prisma.$queryRaw<CustomerSummaryRow[]>`
      SELECT * FROM v_customer_summary ORDER BY name ASC
    `,
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Build a lookup for outstanding + last activity (payment, else sale) from
  // the summary view, keyed by customer id.
  const summaryById = new Map(
    summaryRows.map((r) => [
      r.customer_id,
      {
        outstanding: Number(r.outstanding),
        lastActivity: r.last_payment_date ?? r.last_sale_date ?? null,
      },
    ])
  );

  const list = customers.map((c) => {
    const summary = summaryById.get(c.id);
    return {
      customer: c,
      outstanding: summary?.outstanding ?? 0,
      lastActivity: summary?.lastActivity ?? null,
    };
  });

  const filtered = list.filter(({ customer: c, outstanding, lastActivity }) => {
    if (
      query &&
      !(
        c.name.toLowerCase().includes(query) ||
        c.company?.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query)
      )
    )
      return false;
    if (balance === "owes" && !(outstanding > 0.005)) return false;
    if (balance === "clear" && Math.abs(outstanding) > 0.005) return false;
    if (balance === "credit" && !(outstanding < -0.005)) return false;
    if (aging !== null) {
      // Aging only makes sense for customers who still owe us; a missing
      // last activity counts as maximally overdue.
      if (!(outstanding > 0.005)) return false;
      const days = lastActivity ? daysSince(lastActivity) : Infinity;
      if (days < aging) return false;
    }
    return true;
  });

  if (sort === "outstanding") {
    filtered.sort((a, b) => b.outstanding - a.outstanding);
  }

  const { page, pageCount, total, pageRows } = paginate(filtered, sp.page);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Customers
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Manage customer records.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          Add Customer
        </h2>
        <CreateCustomerForm />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Suspense>
            <FilterSearch
              paramName="q"
              value={sp.q ?? ""}
              placeholder="Name, company, phone"
            />
            <FilterSelect
              paramName="balance"
              value={balance ?? ""}
              options={BALANCE_OPTIONS}
              allLabel="Any balance"
            />
            <FilterSelect
              paramName="aging"
              value={aging !== null ? String(aging) : ""}
              options={AGING_OPTIONS}
              allLabel="Any aging"
            />
            <FilterSelect
              paramName="sort"
              value={sort === "outstanding" ? "outstanding" : ""}
              options={SORT_OPTIONS}
              allLabel="Sort: Name"
            />
            {hasFilters && <ResetFilters params={["q", "balance", "aging"]} />}
          </Suspense>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 text-right font-medium">Outstanding</th>
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
                      ? "No customers match the current filters."
                      : "No customers yet."}
                  </td>
                </tr>
              )}
              {pageRows.map(({ customer: c, outstanding, lastActivity }) => (
                <tr
                  key={c.id}
                  className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    <Link
                      href={`/customers/${c.id}`}
                      className="hover:underline text-green-700 dark:text-green-400"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {c.company ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {c.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {outstanding > 0 ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          {formatPKR(outstanding)}
                        </span>
                        <AgingBadge date={lastActivity} />
                      </div>
                    ) : outstanding < 0 ? (
                      <span className="font-semibold text-green-700 dark:text-green-400">
                        {formatPKR(Math.abs(outstanding))} Cr
                      </span>
                    ) : (
                      <span className="text-neutral-400">{formatPKR(outstanding)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <EditDialog title="Edit Customer">
                        <EditCustomerForm
                          existing={{
                            id: c.id,
                            name: c.name,
                            company: c.company,
                            phone: c.phone,
                            openingBalance: c.openingBalance.toNumber(),
                          }}
                        />
                      </EditDialog>
                      <DeleteCustomerButton
                        customerId={c.id}
                        customerName={c.name}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Suspense>
          <Pagination page={page} pageCount={pageCount} total={total} noun="customers" />
        </Suspense>
      </section>
    </div>
  );
}
