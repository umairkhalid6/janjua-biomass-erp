import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import {
  formatPKR,
  parsePeriodParam,
  periodLabel,
  periodRange,
} from "@/lib/format";
import {
  bucketLabel,
  defaultGrainBuckets,
  grainUnit,
  grainWindowLabel,
  grainWindowStart,
  parseGrainParam,
} from "@/lib/granularity";
import { PeriodPicker } from "@/components/period-picker";
import { GrainPicker } from "@/components/grain-picker";
import { ProfitTrendChart } from "@/components/charts/profit-trend-chart";

// Period totals: v_monthly_summary is month-grain, so a window is just a SUM
// over the months in range. Postgres numerics arrive as strings via pg.
type PeriodTotalsRow = {
  sales_revenue: string | number;
  bags_sold: string | number;
  bags_produced: string | number;
  purchases: string | number;
  labor_cost: string | number;
  expenses: string | number;
  electricity_cost: string | number;
  total_cost: string | number;
  profit: string | number;
};
type LedgerBalanceRow = { balance: string | number };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; grain?: string }>;
}) {
  const user = await requireUser();
  // Dashboard is ADMIN-only. Operators are bounced to /production (middleware
  // also enforces this at the edge; this guards direct RSC render/refresh).
  if (user.role !== "ADMIN") redirect("/production");
  const sp = await searchParams;
  const period = parsePeriodParam(sp.period);
  const { gte, lte } = periodRange(period);
  const grain = parseGrainParam(sp.grain);
  // Keep the monthly trend at its original 6-month window; day/week grains
  // use the standard trailing windows (30 days / 12 weeks).
  const trendBuckets = grain === "monthly" ? 6 : defaultGrainBuckets(grain);
  const trendStart = grainWindowStart(grain, trendBuckets);

  // --- ADMIN dashboard ---
  const [summaryRows, balanceRows, trendRows] = await Promise.all([
    prisma.$queryRaw<PeriodTotalsRow[]>`
      SELECT
        COALESCE(SUM(sales_revenue), 0)               AS sales_revenue,
        COALESCE(SUM(bags_sold), 0)                   AS bags_sold,
        COALESCE(SUM(bags_produced), 0)               AS bags_produced,
        COALESCE(SUM(sawdust_cost + chips_cost), 0)   AS purchases,
        COALESCE(SUM(labor_cost), 0)                  AS labor_cost,
        COALESCE(SUM(expenses), 0)                    AS expenses,
        COALESCE(SUM(electricity_cost), 0)            AS electricity_cost,
        COALESCE(SUM(total_cost), 0)                  AS total_cost,
        COALESCE(SUM(profit), 0)                      AS profit
      FROM v_monthly_summary
      WHERE month >= ${gte}::date AND month <= ${lte}::date
    `,
    prisma.$queryRaw<LedgerBalanceRow[]>`
      SELECT balance FROM v_contractor_ledger
      ORDER BY date DESC, entry_type DESC, description DESC
      LIMIT 1
    `,
    prisma.$queryRaw<{ bucket: Date; profit: string | number }[]>`
      SELECT date_trunc(${grainUnit(grain)}::text, day)::date AS bucket,
             SUM(profit) AS profit
      FROM v_daily_summary
      WHERE day >= ${trendStart}::date
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const s = summaryRows[0];
  const n = (v: string | number | undefined) => Number(v ?? 0);
  const sales = n(s?.sales_revenue);
  const purchases = n(s?.purchases);
  const laborCost = n(s?.labor_cost);
  const expenses = n(s?.expenses);
  const electricity = n(s?.electricity_cost);
  const totalCost = n(s?.total_cost);
  const profit = n(s?.profit);
  const bagsProduced = n(s?.bags_produced);
  const bagsSold = n(s?.bags_sold);
  const contractorBalance = balanceRows.length ? Number(balanceRows[0].balance) : 0;

  const trend = trendRows.map((r) => ({
    label: bucketLabel(grain, r.bucket),
    profit: Number(r.profit),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">{periodLabel(period)}</p>
        </div>
        <Suspense>
          <PeriodPicker value={period} />
        </Suspense>
      </div>

      {/* Headline cards — totals for the selected period */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Sales" value={formatPKR(sales)} sub={`${bagsSold.toLocaleString()} bags sold`} tone="blue" />
        <StatCard label="Purchases" value={formatPKR(purchases)} sub="sawdust + chips" tone="amber" />
        <StatCard label="Contractor" value={formatPKR(laborCost)} sub="labor cost" tone="amber" />
        <StatCard label="Expenses" value={formatPKR(expenses)} sub="operating" tone="amber" />
        <StatCard label="Electricity" value={formatPKR(electricity)} sub="bills" tone="amber" />
        <StatCard label="Total Cost" value={formatPKR(totalCost)} sub="all costs" tone="amber" />
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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Profit — {grainWindowLabel(grain, trendBuckets)}
            </p>
            <Suspense>
              <GrainPicker value={grain} />
            </Suspense>
          </div>
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
