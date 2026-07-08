import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatPKR } from "@/lib/format";
import { EditDialog } from "@/components/edit-dialog";
import { AgingBadge } from "@/components/aging-badge";
import { CreateCustomerForm, EditCustomerForm } from "./customer-forms";

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

export default async function CustomersPage() {
  await requireAdmin();

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
              {customers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-neutral-400"
                  >
                    No customers yet.
                  </td>
                </tr>
              )}
              {customers.map((c) => {
                const summary = summaryById.get(c.id);
                const outstanding = summary?.outstanding ?? 0;
                return (
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
                          <AgingBadge date={summary?.lastActivity ?? null} />
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
