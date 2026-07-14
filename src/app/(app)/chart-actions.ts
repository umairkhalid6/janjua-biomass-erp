"use server";

// Chart-data server actions for the daily/weekly/monthly grain pickers.
// Pages render their charts server-side from searchParams; when the user flips
// the grain, the chart section calls one of these to swap just its own series
// instead of re-rendering (and re-querying) the whole page.
//
// Each action re-validates the grain param and the caller's session — these are
// public POST endpoints, same trust level as a page load.

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  defaultGrainBuckets,
  grainUnit,
  grainWindowStart,
  parseGrainParam,
  type Grain,
} from "@/lib/granularity";

// Bucket dates travel as ISO strings; client sections re-derive labels with
// the granularity helpers so labels and data can never disagree.
export type ProfitPoint = { bucket: string; profit: number };
export type ProductionTrendPoint = { bucket: string; bags: number };
export type MaterialTrendPoint = { bucket: string; materialType: string; cost: number };
export type EarnedPaidPoint = { bucket: string; earned: number; paid: number };

async function profitBuckets(grain: Grain, buckets: number): Promise<ProfitPoint[]> {
  const start = grainWindowStart(grain, buckets);
  const rows = await prisma.$queryRaw<{ bucket: Date; profit: string | number }[]>`
    SELECT date_trunc(${grainUnit(grain)}::text, day)::date AS bucket,
           SUM(profit) AS profit
    FROM v_daily_summary
    WHERE day >= ${start}::date
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    bucket: new Date(r.bucket).toISOString(),
    profit: Number(r.profit),
  }));
}

/** Dashboard profit trend: monthly keeps its original 6-month window. */
export async function fetchDashboardProfitTrend(grainParam: string): Promise<ProfitPoint[]> {
  await requireAdmin();
  const grain = parseGrainParam(grainParam);
  const buckets = grain === "monthly" ? 6 : defaultGrainBuckets(grain);
  return profitBuckets(grain, buckets);
}

/** P&L profit history (chart + table) over the standard trailing window. */
export async function fetchPnlHistory(grainParam: string): Promise<ProfitPoint[]> {
  await requireAdmin();
  const grain = parseGrainParam(grainParam);
  return profitBuckets(grain, defaultGrainBuckets(grain));
}

/** Production trend: total bags per bucket over the standard trailing window. */
export async function fetchProductionTrend(grainParam: string): Promise<ProductionTrendPoint[]> {
  await requireAdmin();
  const grain = parseGrainParam(grainParam);
  const start = grainWindowStart(grain, defaultGrainBuckets(grain));
  const rows = await prisma.$queryRaw<{ bucket: Date; total_bags: string | number }[]>`
    SELECT date_trunc(${grainUnit(grain)}::text, date)::date AS bucket,
           SUM("dayShiftBags" + "nightShiftBags") AS total_bags
    FROM production_days
    WHERE date >= ${start}::date
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    bucket: new Date(r.bucket).toISOString(),
    bags: Number(r.total_bags),
  }));
}

/** Material cost per type per bucket; monthly keeps its 6-month window. */
export async function fetchMaterialTrend(grainParam: string): Promise<MaterialTrendPoint[]> {
  await requireAdmin();
  const grain = parseGrainParam(grainParam);
  const buckets = grain === "monthly" ? 6 : defaultGrainBuckets(grain);
  const start = grainWindowStart(grain, buckets);
  const rows = await prisma.$queryRaw<
    { bucket: Date; material_type: string; total_cost: string | number }[]
  >`
    SELECT date_trunc(${grainUnit(grain)}::text, date)::date AS bucket,
           "materialType" AS material_type,
           SUM("materialCost" + "handlingCost") AS total_cost
    FROM material_purchases
    WHERE date >= ${start}::date
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    bucket: new Date(r.bucket).toISOString(),
    materialType: r.material_type,
    cost: Number(r.total_cost),
  }));
}

/** Contractor earned vs paid per bucket over the standard trailing window. */
export async function fetchContractorEarnedPaid(grainParam: string): Promise<EarnedPaidPoint[]> {
  await requireAdmin();
  const grain = parseGrainParam(grainParam);
  const start = grainWindowStart(grain, defaultGrainBuckets(grain));
  const rows = await prisma.$queryRaw<
    { bucket: Date; earned: string | number; paid: string | number }[]
  >`
    WITH e AS (
      SELECT date_trunc(${grainUnit(grain)}::text, date)::date AS bucket, SUM(amount) AS earned
      FROM v_contractor_ledger WHERE entry_type = 'EARNED' GROUP BY 1
    ),
    p AS (
      SELECT date_trunc(${grainUnit(grain)}::text, date)::date AS bucket, SUM(-amount) AS paid
      FROM v_contractor_ledger WHERE entry_type = 'PAYMENT' GROUP BY 1
    )
    SELECT COALESCE(e.bucket, p.bucket) AS bucket,
           COALESCE(e.earned, 0) AS earned,
           COALESCE(p.paid, 0) AS paid
    FROM e FULL OUTER JOIN p ON e.bucket = p.bucket
    WHERE COALESCE(e.bucket, p.bucket) >= ${start}::date
    ORDER BY bucket ASC
  `;
  return rows.map((r) => ({
    bucket: new Date(r.bucket).toISOString(),
    earned: Number(r.earned),
    paid: Number(r.paid),
  }));
}
