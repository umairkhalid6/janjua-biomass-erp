-- Contractor labor is paid per shift: the night shift earns less per kg than
-- the day shift (6 vs 5 PKR/kg when this split was introduced). A ContractorRate
-- row now carries BOTH rates for one effective-from date, so a rate change is
-- still one dated row and the "rate effective on the production date" lookup is
-- unchanged.
--
-- Backfill: every rate row on record predates the split and its single rate was
-- the DAY rate (the column is renamed, not re-entered). The night shift has
-- always been paid 5.00 PKR/kg, so existing rows get nightRatePerKg = 5.00 and
-- past night production is re-costed at 5 automatically — the views derive
-- labor cost, nothing is stored per production row.
ALTER TABLE "contractor_rates" RENAME COLUMN "ratePerKg" TO "dayRatePerKg";
ALTER TABLE "contractor_rates" ADD COLUMN "nightRatePerKg" DECIMAL(8,2) NOT NULL DEFAULT 0;
UPDATE "contractor_rates" SET "nightRatePerKg" = 5.00;
ALTER TABLE "contractor_rates" ALTER COLUMN "nightRatePerKg" DROP DEFAULT;

-- v_labor_daily costs each shift at its own rate. Dropping it cascades to
-- v_contractor_ledger, v_monthly_summary and v_daily_summary; all three are
-- recreated below verbatim — only the labor_cost they read changes.
DROP VIEW v_labor_daily CASCADE;

-- Daily labor cost for the contractor (Thekadar):
-- day bags × 40 kg × day rate + night bags × 40 kg × night rate,
-- both rates taken from the row effective on that production date.
CREATE VIEW v_labor_daily AS
SELECT
  p.date,
  (p."dayShiftBags" + p."nightShiftBags")                              AS bags,
  p."dayShiftBags"                                                     AS day_bags,
  p."nightShiftBags"                                                   AS night_bags,
  COALESCE(r."dayRatePerKg", 0)                                        AS day_rate_per_kg,
  COALESCE(r."nightRatePerKg", 0)                                      AS night_rate_per_kg,
  ROUND(p."dayShiftBags"   * 40 * COALESCE(r."dayRatePerKg", 0), 2)    AS day_labor_cost,
  ROUND(p."nightShiftBags" * 40 * COALESCE(r."nightRatePerKg", 0), 2)  AS night_labor_cost,
  ROUND(p."dayShiftBags"   * 40 * COALESCE(r."dayRatePerKg", 0), 2)
    + ROUND(p."nightShiftBags" * 40 * COALESCE(r."nightRatePerKg", 0), 2) AS labor_cost
FROM production_days p
LEFT JOIN LATERAL (
  SELECT "dayRatePerKg", "nightRatePerKg"
  FROM contractor_rates
  WHERE "effectiveFrom" <= p.date
  ORDER BY "effectiveFrom" DESC
  LIMIT 1
) r ON true;

-- Contractor ledger with running balance (replaces 'Thekadar Sheet').
-- Positive balance = owed to the contractor.
CREATE VIEW v_contractor_ledger AS
WITH entries AS (
  SELECT date,
         'EARNED'::text                                   AS entry_type,
         'Production ' || to_char(date, 'DD Mon YYYY')    AS description,
         labor_cost                                       AS amount
  FROM v_labor_daily
  WHERE bags > 0
  UNION ALL
  SELECT date, 'PAYMENT', COALESCE(notes, 'Payment'), -amount
  FROM contractor_payments
  UNION ALL
  SELECT date, 'ADJUSTMENT', reason, amount
  FROM contractor_adjustments
)
SELECT
  date,
  entry_type,
  description,
  amount,
  SUM(amount) OVER (ORDER BY date, entry_type, description
                    ROWS UNBOUNDED PRECEDING) AS balance
FROM entries;

-- Monthly P&L. sales_revenue is NET pellet revenue (loading excluded);
-- loading_charges is a pass-through column outside the profit calculation.
CREATE VIEW "v_monthly_summary" AS
WITH months AS (
  SELECT DISTINCT month FROM (
    SELECT date_trunc('month', date)::date AS month FROM pellet_sales
    UNION SELECT date_trunc('month', date)::date FROM material_purchases
    UNION SELECT date_trunc('month', date)::date FROM production_days
    UNION SELECT date_trunc('month', date)::date FROM expenses
    UNION SELECT date_trunc('month', month)::date FROM electricity_bills
    UNION SELECT date_trunc('month', date)::date FROM contractor_payments
  ) m
),
sales AS (
  SELECT date_trunc('month', date)::date AS month,
         SUM("quantityBags") AS bags_sold,
         SUM("quantityBags" * "ratePerBag") AS revenue,
         SUM("quantityBags" * "loadingChargePerBag") AS loading_charges,
         CASE WHEN SUM("quantityBags") > 0
              THEN ROUND(SUM("quantityBags" * "ratePerBag") / SUM("quantityBags"), 2)
              ELSE 0 END AS avg_rate_per_bag
  FROM pellet_sales GROUP BY 1
),
mat AS (
  SELECT date_trunc('month', date)::date AS month,
         SUM(CASE WHEN "materialType" <> 'WOOD_CHIPS' THEN "materialCost" + "handlingCost" ELSE 0 END) AS sawdust_cost,
         SUM(CASE WHEN "materialType" =  'WOOD_CHIPS' THEN "materialCost" + "handlingCost" ELSE 0 END) AS chips_cost
  FROM material_purchases GROUP BY 1
),
prod AS (
  SELECT date_trunc('month', date)::date AS month,
         SUM("dayShiftBags" + "nightShiftBags") AS bags_produced
  FROM production_days GROUP BY 1
),
labor AS (
  SELECT date_trunc('month', date)::date AS month, SUM(labor_cost) AS labor_cost
  FROM v_labor_daily GROUP BY 1
),
exp AS (
  SELECT date_trunc('month', date)::date AS month, SUM(amount) AS expenses
  FROM expenses GROUP BY 1
),
elec AS (
  SELECT date_trunc('month', month)::date AS month, SUM("billAmount") AS electricity_cost
  FROM electricity_bills GROUP BY 1
)
SELECT
  mo.month,
  COALESCE(s.revenue, 0)           AS sales_revenue,
  COALESCE(s.loading_charges, 0)   AS loading_charges,
  COALESCE(s.bags_sold, 0)         AS bags_sold,
  COALESCE(s.avg_rate_per_bag, 0)  AS avg_rate_per_bag,
  COALESCE(p.bags_produced, 0)     AS bags_produced,
  COALESCE(m.sawdust_cost, 0)      AS sawdust_cost,
  COALESCE(m.chips_cost, 0)        AS chips_cost,
  COALESCE(l.labor_cost, 0)        AS labor_cost,
  COALESCE(e.expenses, 0)          AS expenses,
  COALESCE(el.electricity_cost, 0) AS electricity_cost,
  COALESCE(m.sawdust_cost, 0) + COALESCE(m.chips_cost, 0) + COALESCE(l.labor_cost, 0)
    + COALESCE(e.expenses, 0) + COALESCE(el.electricity_cost, 0) AS total_cost,
  COALESCE(s.revenue, 0)
    - (COALESCE(m.sawdust_cost, 0) + COALESCE(m.chips_cost, 0) + COALESCE(l.labor_cost, 0)
       + COALESCE(e.expenses, 0) + COALESCE(el.electricity_cost, 0)) AS profit
FROM months mo
LEFT JOIN sales s ON s.month = mo.month
LEFT JOIN mat   m ON m.month = mo.month
LEFT JOIN prod  p ON p.month = mo.month
LEFT JOIN labor l ON l.month = mo.month
LEFT JOIN exp   e ON e.month = mo.month
LEFT JOIN elec el ON el.month = mo.month;

-- Day-grain P&L summary powering the Daily / Weekly / Monthly chart
-- granularity switcher. Mirrors v_monthly_summary but buckets by calendar day.
CREATE VIEW v_daily_summary AS
WITH days AS (
  SELECT DISTINCT day FROM (
    SELECT date::date AS day FROM pellet_sales
    UNION SELECT date::date FROM material_purchases
    UNION SELECT date::date FROM production_days
    UNION SELECT date::date FROM expenses
    UNION SELECT date_trunc('month', month)::date FROM electricity_bills
    UNION SELECT date::date FROM contractor_payments
  ) d
),
sales AS (
  SELECT date::date AS day,
         SUM("quantityBags") AS bags_sold,
         SUM("quantityBags" * "ratePerBag") AS revenue,
         SUM("quantityBags" * "loadingChargePerBag") AS loading_charges
  FROM pellet_sales GROUP BY 1
),
mat AS (
  SELECT date::date AS day,
         SUM(CASE WHEN "materialType" <> 'WOOD_CHIPS' THEN "materialCost" + "handlingCost" ELSE 0 END) AS sawdust_cost,
         SUM(CASE WHEN "materialType" =  'WOOD_CHIPS' THEN "materialCost" + "handlingCost" ELSE 0 END) AS chips_cost
  FROM material_purchases GROUP BY 1
),
prod AS (
  SELECT date::date AS day,
         SUM("dayShiftBags" + "nightShiftBags") AS bags_produced
  FROM production_days GROUP BY 1
),
labor AS (
  SELECT date::date AS day, SUM(labor_cost) AS labor_cost
  FROM v_labor_daily GROUP BY 1
),
exp AS (
  SELECT date::date AS day, SUM(amount) AS expenses
  FROM expenses GROUP BY 1
),
elec AS (
  SELECT date_trunc('month', month)::date AS day, SUM("billAmount") AS electricity_cost
  FROM electricity_bills GROUP BY 1
)
SELECT
  dd.day,
  COALESCE(s.revenue, 0)           AS sales_revenue,
  COALESCE(s.loading_charges, 0)   AS loading_charges,
  COALESCE(s.bags_sold, 0)         AS bags_sold,
  COALESCE(p.bags_produced, 0)     AS bags_produced,
  COALESCE(m.sawdust_cost, 0)      AS sawdust_cost,
  COALESCE(m.chips_cost, 0)        AS chips_cost,
  COALESCE(l.labor_cost, 0)        AS labor_cost,
  COALESCE(e.expenses, 0)          AS expenses,
  COALESCE(el.electricity_cost, 0) AS electricity_cost,
  COALESCE(m.sawdust_cost, 0) + COALESCE(m.chips_cost, 0) + COALESCE(l.labor_cost, 0)
    + COALESCE(e.expenses, 0) + COALESCE(el.electricity_cost, 0) AS total_cost,
  COALESCE(s.revenue, 0)
    - (COALESCE(m.sawdust_cost, 0) + COALESCE(m.chips_cost, 0) + COALESCE(l.labor_cost, 0)
       + COALESCE(e.expenses, 0) + COALESCE(el.electricity_cost, 0)) AS profit
FROM days dd
LEFT JOIN sales s ON s.day = dd.day
LEFT JOIN mat   m ON m.day = dd.day
LEFT JOIN prod  p ON p.day = dd.day
LEFT JOIN labor l ON l.day = dd.day
LEFT JOIN exp   e ON e.day = dd.day
LEFT JOIN elec el ON el.day = dd.day;
