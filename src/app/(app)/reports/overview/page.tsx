import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatPKR } from "@/lib/format";
import { BAG_KG, MATERIAL_LABELS } from "@/lib/constants";
import { CHART } from "@/components/charts/palette";
import {
  CostMixChart,
  DailyProductionChart,
  HorizontalBarChart,
  ProducedVsSoldChart,
  RateVsCostChart,
  RevenueCostProfitChart,
} from "@/components/charts/overview-charts";

export const dynamic = "force-dynamic";

type SummaryRow = {
  month: Date;
  sales_revenue: string | number;
  loading_charges: string | number;
  bags_sold: string | number;
  avg_rate_per_bag: string | number;
  bags_produced: string | number;
  sawdust_cost: string | number;
  chips_cost: string | number;
  labor_cost: string | number;
  expenses: string | number;
  electricity_cost: string | number;
  total_cost: string | number;
  profit: string | number;
};

const n = (v: string | number | null | undefined) => Number(v ?? 0);
const monthLabel = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

export default async function OverviewPage() {
  await requireAdmin();

  const [summary, daily, expenseItems, materials, contractorPayments, bills, topCustomers, topSuppliers] =
    await Promise.all([
      prisma.$queryRaw<SummaryRow[]>`
        SELECT * FROM v_monthly_summary ORDER BY month ASC
      `,
      prisma.$queryRaw<{ date: Date; day: string | number; night: string | number }[]>`
        SELECT date, "dayShiftBags" AS day, "nightShiftBags" AS night
        FROM production_days ORDER BY date ASC
      `,
      prisma.$queryRaw<{ item: string; total: string | number }[]>`
        SELECT item, SUM(amount) AS total
        FROM expenses GROUP BY item ORDER BY SUM(amount) DESC LIMIT 12
      `,
      prisma.$queryRaw<
        { material: string; weight: string | number; cost: string | number; rate: string | number }[]
      >`
        SELECT "materialType"::text AS material,
               SUM("weightKg") AS weight,
               SUM("materialCost" + "handlingCost") AS cost,
               CASE WHEN SUM("weightKg") > 0
                    THEN ROUND(SUM("materialCost" + "handlingCost") / SUM("weightKg"), 2)
                    ELSE 0 END AS rate
        FROM material_purchases GROUP BY 1 ORDER BY SUM("materialCost" + "handlingCost") DESC
      `,
      prisma.$queryRaw<{ month: Date; paid: string | number }[]>`
        SELECT date_trunc('month', date)::date AS month, SUM(amount) AS paid
        FROM contractor_payments GROUP BY 1 ORDER BY 1 ASC
      `,
      prisma.$queryRaw<{ month: Date; bill: string | number; units: string | number }[]>`
        SELECT month, "billAmount" AS bill, "unitsConsumed" AS units
        FROM electricity_bills ORDER BY month ASC
      `,
      prisma.$queryRaw<{ name: string; bags: string | number; revenue: string | number }[]>`
        SELECT c.name,
               SUM(s."quantityBags") AS bags,
               SUM(s."quantityBags" * s."ratePerBag") AS revenue
        FROM pellet_sales s JOIN customers c ON c.id = s."customerId"
        GROUP BY c.name ORDER BY 3 DESC LIMIT 10
      `,
      prisma.$queryRaw<{ name: string; weight: string | number; cost: string | number }[]>`
        SELECT sp.name,
               SUM(m."weightKg") AS weight,
               SUM(m."materialCost" + m."handlingCost") AS cost
        FROM material_purchases m JOIN suppliers sp ON sp.id = m."supplierId"
        GROUP BY sp.name ORDER BY 3 DESC LIMIT 10
      `,
    ]);

  const months = summary.map((s) => {
    const produced = n(s.bags_produced);
    const bagsSold = n(s.bags_sold);
    const cost = n(s.total_cost);
    const revenue = n(s.sales_revenue);
    const profit = n(s.profit);
    return {
      key: new Date(s.month).toISOString().slice(0, 7),
      label: monthLabel(s.month),
      revenue,
      loading: n(s.loading_charges),
      bagsSold,
      avgRate: n(s.avg_rate_per_bag),
      produced,
      sawdust: n(s.sawdust_cost),
      chips: n(s.chips_cost),
      labor: n(s.labor_cost),
      expenses: n(s.expenses),
      electricity: n(s.electricity_cost),
      cost,
      profit,
      // Margin on revenue: what share of each rupee sold is kept as profit.
      marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
      // Per-bag figures are all on a SOLD basis so they reconcile against the
      // average sale rate: rate - cost/bag = profit/bag. (Bags produced and
      // bags sold differ month to month, so mixing the two bases does not.)
      costPerBag: bagsSold > 0 ? cost / bagsSold : 0,
      profitPerBag: bagsSold > 0 ? profit / bagsSold : 0,
    };
  });

  const totals = months.reduce(
    (a, m) => ({
      revenue: a.revenue + m.revenue,
      cost: a.cost + m.cost,
      profit: a.profit + m.profit,
      produced: a.produced + m.produced,
      bagsSold: a.bagsSold + m.bagsSold,
      loading: a.loading + m.loading,
      sawdust: a.sawdust + m.sawdust,
      chips: a.chips + m.chips,
      labor: a.labor + m.labor,
      expenses: a.expenses + m.expenses,
      electricity: a.electricity + m.electricity,
    }),
    { revenue: 0, cost: 0, profit: 0, produced: 0, bagsSold: 0, loading: 0, sawdust: 0, chips: 0, labor: 0, expenses: 0, electricity: 0 }
  );

  const marginPct = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  // Period-wide per-bag figures are re-derived from period totals, never
  // averaged across months (months have different volumes).
  const avgRateAll = totals.bagsSold > 0 ? totals.revenue / totals.bagsSold : 0;
  const costPerBagAll = totals.bagsSold > 0 ? totals.cost / totals.bagsSold : 0;
  const profitPerBagAll = totals.bagsSold > 0 ? totals.profit / totals.bagsSold : 0;

  const dailyData = daily.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    day: n(d.day),
    night: n(d.night),
    total: n(d.day) + n(d.night),
  }));

  const paidByMonth = new Map(
    contractorPayments.map((c) => [new Date(c.month).toISOString().slice(0, 7), n(c.paid)])
  );
  const billByMonth = new Map(
    bills.map((b) => [new Date(b.month).toISOString().slice(0, 7), { bill: n(b.bill), units: n(b.units) }])
  );

  const costLines = [
    { label: "Sawdust", key: "sawdust" as const, total: totals.sawdust },
    { label: "Wood chips", key: "chips" as const, total: totals.chips },
    { label: "Contractor (thekadar)", key: "labor" as const, total: totals.labor },
    { label: "Electricity", key: "electricity" as const, total: totals.electricity },
    { label: "Maintenance / other", key: "expenses" as const, total: totals.expenses },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Business Overview
        </h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          {months.length > 0
            ? `${months[0].label} – ${months[months.length - 1].label} · everything on one page`
            : "No data"}
        </p>
      </div>

      {/* Headline figures */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue" value={formatPKR(totals.revenue)} tone="blue" />
        <Kpi label="Total cost" value={formatPKR(totals.cost)} tone="amber" />
        <Kpi
          label="Profit"
          value={formatPKR(totals.profit)}
          sub={`${marginPct.toFixed(1)}% margin`}
          tone={totals.profit >= 0 ? "green" : "red"}
        />
        <Kpi
          label="Bags Sold"
          value={totals.bagsSold.toLocaleString()}
          sub="bags (40 kg)"
          tone="blue"
        />
        <Kpi
          label="Bags Produced"
          value={totals.produced.toLocaleString()}
          sub="bags (40 kg)"
          tone="slate"
        />
      </section>

      {/* Money */}
      <Card title="Revenue, cost and profit by month">
        <RevenueCostProfitChart
          data={months.map((m) => ({ label: m.label, revenue: m.revenue, cost: m.cost, profit: m.profit }))}
        />
      </Card>

      {/* Full P&L table */}
      <Card title="Profit &amp; loss" bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Line</th>
                {months.map((m) => (
                  <th key={m.key} className="px-4 py-3 text-right font-medium">{m.label}</th>
                ))}
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              <tr className="bg-blue-50/60 dark:bg-blue-950/30">
                <td className="px-4 py-2.5 font-semibold text-neutral-900 dark:text-neutral-50">Revenue</td>
                {months.map((m) => (
                  <td key={m.key} className="px-4 py-2.5 text-right font-semibold text-blue-700 dark:text-blue-400">
                    {formatPKR(m.revenue)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-semibold text-blue-700 dark:text-blue-400">
                  {formatPKR(totals.revenue)}
                </td>
              </tr>
              {costLines.map((line) => (
                <tr key={line.key}>
                  <td className="px-4 py-2.5 pl-8 text-neutral-600 dark:text-neutral-400">{line.label}</td>
                  {months.map((m) => (
                    <td key={m.key} className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                      ({formatPKR(m[line.key])})
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                    ({formatPKR(line.total)})
                  </td>
                </tr>
              ))}
              <tr className="bg-amber-50/60 dark:bg-amber-950/30">
                <td className="px-4 py-2.5 font-semibold text-neutral-900 dark:text-neutral-50">Total cost</td>
                {months.map((m) => (
                  <td key={m.key} className="px-4 py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                    ({formatPKR(m.cost)})
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-semibold text-amber-700 dark:text-amber-400">
                  ({formatPKR(totals.cost)})
                </td>
              </tr>
              <tr className="bg-green-50 dark:bg-green-950/40">
                <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-50">Profit</td>
                {months.map((m) => (
                  <td
                    key={m.key}
                    className={`px-4 py-3 text-right font-bold ${
                      m.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatPKR(m.profit)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-green-700 dark:text-green-400">
                  {formatPKR(totals.profit)}
                </td>
              </tr>
              <tr className="bg-green-50/60 dark:bg-green-950/20">
                <td className="px-4 py-2.5 font-semibold text-neutral-900 dark:text-neutral-50">
                  Profit margin
                  <span className="ml-2 text-xs font-normal text-neutral-500">% of revenue</span>
                </td>
                {months.map((m) => (
                  <td
                    key={m.key}
                    className={`px-4 py-2.5 text-right font-semibold ${
                      m.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {m.marginPct.toFixed(1)}%
                  </td>
                ))}
                <td
                  className={`px-4 py-2.5 text-right font-semibold ${
                    totals.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {marginPct.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Cost composition">
          <CostMixChart
            data={months.map((m) => ({
              label: m.label,
              sawdust: m.sawdust,
              chips: m.chips,
              labor: m.labor,
              electricity: m.electricity,
              expenses: m.expenses,
            }))}
          />
        </Card>
        <Card title="Sale rate vs cost per bag">
          <RateVsCostChart
            data={months.map((m) => ({
              label: m.label,
              rate: Math.round(m.avgRate),
              costPerBag: Math.round(m.costPerBag),
            }))}
          />
        </Card>
      </div>

      {/* Production */}
      <Card title="Daily production (day + night shift)">
        <DailyProductionChart data={dailyData} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Produced vs sold">
          <ProducedVsSoldChart
            data={months.map((m) => ({ label: m.label, produced: m.produced, sold: m.bagsSold }))}
          />
        </Card>
        <Card title="Production &amp; unit economics" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Metric</th>
                  {months.map((m) => (
                    <th key={m.key} className="px-4 py-3 text-right font-medium">{m.label}</th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                <Row
                  label="Bags produced"
                  values={[...months.map((m) => m.produced.toLocaleString()), totals.produced.toLocaleString()]}
                />
                <Row
                  label="Bags sold"
                  values={[...months.map((m) => m.bagsSold.toLocaleString()), totals.bagsSold.toLocaleString()]}
                />
                <Row
                  label="Avg sale rate / bag"
                  values={[...months.map((m) => formatPKR(m.avgRate)), formatPKR(avgRateAll)]}
                />
                <Row
                  label="Cost / bag sold"
                  values={[...months.map((m) => formatPKR(m.costPerBag)), formatPKR(costPerBagAll)]}
                />
                <Row
                  label="Profit / bag sold"
                  values={[...months.map((m) => formatPKR(m.profitPerBag)), formatPKR(profitPerBagAll)]}
                  strong
                />
                <Row
                  label="Loading charges collected"
                  values={[...months.map((m) => formatPKR(m.loading)), formatPKR(totals.loading)]}
                />
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Contractor + electricity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Contractor (thekadar)" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Month</th>
                  <th className="px-4 py-3 text-right font-medium">Bags</th>
                  <th className="px-4 py-3 text-right font-medium">Earned</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                  <th className="px-4 py-3 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {months.map((m) => {
                  const paid = paidByMonth.get(m.key) ?? 0;
                  const diff = m.labor - paid;
                  return (
                    <tr key={m.key}>
                      <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">{m.label}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-600 dark:text-neutral-400">
                        {m.produced.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                        {formatPKR(m.labor)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                        {formatPKR(paid)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-medium ${
                          diff >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatPKR(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-neutral-200 px-4 py-2.5 text-xs text-neutral-500 dark:border-neutral-800">
            Earned = bags × {BAG_KG} kg × rate per kg. Positive difference means still owed to the contractor.
          </p>
        </Card>

        <Card title="Electricity" bodyClass="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Month</th>
                  <th className="px-4 py-3 text-right font-medium">Bill</th>
                  <th className="px-4 py-3 text-right font-medium">Units</th>
                  <th className="px-4 py-3 text-right font-medium">Per unit</th>
                  <th className="px-4 py-3 text-right font-medium">Per bag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {months.map((m) => {
                  const b = billByMonth.get(m.key);
                  return (
                    <tr key={m.key}>
                      <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">{m.label}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-700 dark:text-neutral-300">
                        {formatPKR(b?.bill ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-600 dark:text-neutral-400">
                        {(b?.units ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-600 dark:text-neutral-400">
                        {b && b.units > 0 ? formatPKR(b.bill / b.units) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-neutral-600 dark:text-neutral-400">
                        {m.produced > 0 ? formatPKR((b?.bill ?? 0) / m.produced) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Materials */}
      <Card title="Raw material purchased" bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Material</th>
                <th className="px-4 py-3 text-right font-medium">Weight (kg)</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Avg rate / kg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {materials.map((m) => (
                <tr key={m.material}>
                  <td className="px-4 py-2.5 text-neutral-700 dark:text-neutral-300">
                    {MATERIAL_LABELS[m.material] ?? m.material}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-600 dark:text-neutral-400">
                    {n(m.weight).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-neutral-900 dark:text-neutral-50">
                    {formatPKR(n(m.cost))}
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-600 dark:text-neutral-400">
                    {formatPKR(n(m.rate))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Expenses + partners */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Biggest expense items">
          <HorizontalBarChart
            data={expenseItems.map((e) => ({ label: e.item, value: n(e.total) }))}
            color={CHART.amber}
          />
        </Card>
        <Card title="Top customers by revenue">
          <HorizontalBarChart
            data={topCustomers.map((c) => ({ label: c.name, value: n(c.revenue) }))}
            color={CHART.blue}
          />
        </Card>
      </div>

      <Card title="Top suppliers by purchase value">
        <HorizontalBarChart
          data={topSuppliers.map((s) => ({ label: s.name, value: n(s.cost) }))}
          color={CHART.teal}
        />
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "blue" | "amber" | "green" | "red" | "slate";
}) {
  const toneClass = {
    blue: "text-blue-700 dark:text-blue-400",
    amber: "text-amber-700 dark:text-amber-400",
    green: "text-green-700 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    slate: "text-neutral-900 dark:text-neutral-50",
  }[tone];
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function Card({
  title,
  children,
  bodyClass = "p-4",
}: {
  title: string;
  children: React.ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-50">
        {title}
      </h2>
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

function Row({
  label,
  values,
  strong,
}: {
  label: string;
  values: string[];
  strong?: boolean;
}) {
  return (
    <tr className={strong ? "bg-green-50/60 dark:bg-green-950/20" : undefined}>
      <td
        className={`px-4 py-2.5 ${
          strong
            ? "font-semibold text-neutral-900 dark:text-neutral-50"
            : "text-neutral-600 dark:text-neutral-400"
        }`}
      >
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-4 py-2.5 text-right ${
            strong
              ? "font-semibold text-green-700 dark:text-green-400"
              : "text-neutral-900 dark:text-neutral-50"
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}
