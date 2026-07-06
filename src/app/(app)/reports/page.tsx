import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";

const REPORTS: { href: string; title: string; desc: string }[] = [
  { href: "/reports/pnl", title: "Profit & Loss", desc: "Monthly P&L, cost breakdown and 12-month profit history." },
  { href: "/reports/production", title: "Production", desc: "Daily day/night output, monthly totals and trend." },
  { href: "/reports/materials", title: "Materials", desc: "Per-material weight, cost and average rate per kg." },
  { href: "/reports/contractor", title: "Contractor Ledger", desc: "Thekadar running balance, payments vs earned." },
  { href: "/reports/customers", title: "Customers", desc: "Sales totals per customer." },
  { href: "/reports/vendors", title: "Vendors", desc: "Purchases, payments and balance owed per vendor." },
];

export default async function ReportsPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Reports</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Financial and operational reports.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-green-600 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-green-600"
          >
            <h2 className="text-sm font-semibold text-neutral-900 group-hover:text-green-700 dark:text-neutral-50 dark:group-hover:text-green-400">
              {r.title}
            </h2>
            <p className="mt-1 text-xs text-neutral-500">{r.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
