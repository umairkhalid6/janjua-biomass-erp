-- Report views: these replace the Google Sheets formulas.
-- BAG_KG = 40 (production/sales are in 40-kg bags; purchases in KG).
-- Fixes vs the old sheet: chip COST (not weight) counts toward monthly cost,
-- Haideri purchases are included, and totals cover ALL rows (no truncated SUM ranges).

-- Daily labor cost for the contractor (Thekadar):
-- bags produced that day × 40 kg × the rate effective on that date.
CREATE VIEW v_labor_daily AS
SELECT
  p.date,
  (p."dayShiftBags" + p."nightShiftBags")                                   AS bags,
  COALESCE(r."ratePerKg", 0)                                                AS rate_per_kg,
  ROUND((p."dayShiftBags" + p."nightShiftBags") * 40 * COALESCE(r."ratePerKg", 0), 2) AS labor_cost
FROM production_days p
LEFT JOIN LATERAL (
  SELECT "ratePerKg"
  FROM contractor_rates
  WHERE "effectiveFrom" <= p.date
  ORDER BY "effectiveFrom" DESC
  LIMIT 1
) r ON true;

-- Monthly production totals (replaces 'Pellets Production' totals row).
CREATE VIEW v_production_summary AS
SELECT
  date_trunc('month', date)::date                    AS month,
  SUM("dayShiftBags")                                AS day_shift_bags,
  SUM("nightShiftBags")                              AS night_shift_bags,
  SUM("dayShiftBags" + "nightShiftBags")             AS total_bags,
  SUM(("dayShiftBags" + "nightShiftBags") * 40)      AS total_kg
FROM production_days
GROUP BY 1;

-- Per material per month: weight, landed cost, average rate/kg
-- (replaces the totals rows of the 4 purchase sheets).
CREATE VIEW v_material_totals AS
SELECT
  date_trunc('month', date)::date                    AS month,
  "materialType"                                     AS material_type,
  SUM("weightKg")                                    AS weight_kg,
  SUM("materialCost" + "handlingCost")               AS total_cost,
  CASE WHEN SUM("weightKg") > 0
       THEN ROUND(SUM("materialCost" + "handlingCost") / SUM("weightKg"), 2)
       ELSE 0 END                                    AS avg_rate_per_kg
FROM material_purchases
GROUP BY 1, 2;

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

-- Per-customer sales totals (replaces 'Pellets Sold' totals + customer list).
CREATE VIEW v_customer_ledger AS
SELECT
  c.id                                                AS customer_id,
  c.name,
  c.company,
  COUNT(s.id)                                         AS sales_count,
  COALESCE(SUM(s."quantityBags"), 0)                  AS total_bags,
  COALESCE(SUM(s."quantityBags" * s."ratePerBag"), 0) AS total_amount,
  MAX(s.date)                                         AS last_sale_date
FROM customers c
LEFT JOIN pellet_sales s ON s."customerId" = c.id
GROUP BY c.id, c.name, c.company;

-- Per-vendor purchases vs payments (what we owe each vendor).
CREATE VIEW v_vendor_ledger AS
SELECT
  v.id                                               AS vendor_id,
  v.name,
  COALESCE(p.total_purchased, 0)                     AS total_purchased,
  COALESCE(pay.total_paid, 0)                        AS total_paid,
  COALESCE(p.total_purchased, 0) - COALESCE(pay.total_paid, 0) AS balance_owed
FROM vendors v
LEFT JOIN (
  SELECT "vendorId", SUM("materialCost" + "handlingCost") AS total_purchased
  FROM material_purchases GROUP BY 1
) p ON p."vendorId" = v.id
LEFT JOIN (
  SELECT "vendorId", SUM(amount) AS total_paid
  FROM vendor_payments GROUP BY 1
) pay ON pay."vendorId" = v.id;

-- Monthly P&L (replaces the 'Main' sheet).
CREATE VIEW v_monthly_summary AS
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
