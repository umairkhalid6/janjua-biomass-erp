import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import {
  currentMonthParam,
  formatMonth,
  formatPKR,
  toDateInputValue,
} from "@/lib/format";
import { ProfitTrendChart } from "@/components/charts/profit-trend-chart";

// Raw view row shapes. Postgres numerics arrive as strings via pg — coerce with Number().
type SummaryRow = {
  month: Date;
  sales_revenue: string | number;
  bags_sold: string | number;
  avg_rate_per_bag: string | number;
  bags_produced: string | number;
  total_cost: string | number;
  profit: string | number;
};
type LedgerBalanceRow = { balance: string | number };
type ProductionRow = {
  day: string | number | null;
  night: string | number | null;
};

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const monthParam = currentMonthParam();

  if (!isAdmin) {
    return <OperatorHome name={user.name ?? user.email ?? "there"} monthParam={monthParam} />;
  }

  // --- ADMIN dashboard ---
  const [summaryRows, balanceRows, trendRows] = await Promise.all([
    prisma.$queryRaw<SummaryRow[]>`
      SELECT * FROM v_monthly_summary
      WHERE month = date_trunc('month', now())::date
    `,
    prisma.$queryRaw<LedgerBalanceRow[]>`
      SELECT balance FROM v_contractor_ledger
      ORDER BY date DESC, entry_type DESC, description DESC
      LIMIT 1
    `,
    prisma.$queryRaw<{ month: Date; profit: string | number }[]>`
      SELECT month, profit FROM v_monthly_summary
      WHERE month >= (date_trunc('month', now()) - interval '5 months')::date
      ORDER BY month ASC
    `,
  ]);

  const s = summaryRows[0];
  const sales = Number(s?.sales_revenue ?? 0);
  const totalCost = Number(s?.total_cost ?? 0);
  const profit = Number(s?.profit ?? 0);
  const bagsProduced = Number(s?.bags_produced ?? 0);
  const bagsSold = Number(s?.bags_sold ?? 0);
  const contractorBalance = balanceRows.length ? Number(balanceRows[0].balance) : 0;

  const trend = trendRows.map((r) => ({
    label: shortMonth(r.month),
    profit: Number(r.profit),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Dashboard
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">{formatMonth(monthParam)}</p>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Sales" value={formatPKR(sales)} sub={`${bagsSold.toLocaleString()} bags sold`} tone="blue" />
        <StatCard label="Total Cost" value={formatPKR(totalCost)} sub="this month" tone="amber" />
        <StatCard
          label="Profit"
          value={formatPKR(profit)}
          sub={profit >= 0 ? "in profit" : "in loss"}
          tone={profit >= 0 ? "green" : "red"}
        />
        <StatCard label="Production" value={`${bagsProduced.toLocaleString()}`} sub="bags produced" tone="slate" />
      </div>

      {/* Contractor balance + profit trend */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Contractor Balance
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-800 dark:text-amber-400">
            {formatPKR(Math.abs(contractorBalance))}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {contractorBalance >= 0 ? "Owed to contractor" : "Contractor owes"}
          </p>
          <Link
            href="/reports/contractor"
            className="mt-3 inline-block text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            View ledger →
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 lg:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Profit — last 6 months
          </p>
          {trend.length > 0 ? (
            <ProfitTrendChart data={trend} />
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <QuickLink href="/production" label="Log Production" />
          <QuickLink href="/sales" label="Record Sale" />
          <QuickLink href="/purchases" label="Add Purchase" />
          <QuickLink href="/expenses" label="Add Expense" />
          <QuickLink href="/reports" label="All Reports" />
        </div>
      </div>
    </div>
  );
}

async function OperatorHome({ name, monthParam }: { name: string; monthParam: string }) {
  // Today's production (UTC-midnight keyed rows).
  const today = toDateInputValue(new Date());
  const rows = await prisma.$queryRaw<ProductionRow[]>`
    SELECT "dayShiftBags" AS day, "nightShiftBags" AS night
    FROM production_days
    WHERE date = ${today}::date
    LIMIT 1
  `;
  const dayBags = Number(rows[0]?.day ?? 0);
  const nightBags = Number(rows[0]?.night ?? 0);
  const totalBags = dayBags + nightBags;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Welcome, {name}
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">{formatMonth(monthParam)}</p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Today&apos;s Production
        </p>
        <p className="mt-1 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
          {totalBags.toLocaleString()} <span className="text-base font-medium text-neutral-500">bags</span>
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Day {dayBags.toLocaleString()} · Night {nightBags.toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <QuickLink href="/production" label="Log Production" />
        <QuickLink href="/sales" label="Record Sale" />
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  blue: "text-blue-700 dark:text-blue-400",
  amber: "text-amber-700 dark:text-amber-400",
  green: "text-green-700 dark:text-green-400",
  red: "text-red-600 dark:text-red-400",
  slate: "text-neutral-900 dark:text-neutral-50",
};

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 truncate text-lg font-bold sm:text-xl ${TONES[tone]}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-medium text-neutral-700 transition hover:border-green-600 hover:text-green-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-green-600 dark:hover:text-green-400"
    >
      {label}
    </Link>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-neutral-400">
      No data yet.
    </div>
  );
}

function shortMonth(month: Date): string {
  return new Date(month).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}
