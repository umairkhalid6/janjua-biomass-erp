-- Loading is a cost of doing business, not a pass-through.
--
-- Until now the P&L views reported sales_revenue NET of the Rs 10/bag loading
-- charge and showed loading_charges as a side column outside the profit
-- calculation. The owner wants loading treated as a business cost instead:
--
--   sales_revenue    = GROSS invoice amount (pellet price + loading), i.e. what
--                      the customer is billed — matches the rate typed in.
--   loading_charges  = Rs 10/bag loading cost (same value as before), now a
--                      COST line included in total_cost.
--   avg_rate_per_bag = gross (invoice) rate per bag.
--
-- Profit is mathematically unchanged (+loading in revenue, +loading in cost);
-- only the presentation moves. Columns keep the same names, order and types,
-- so CREATE OR REPLACE works and no dependent objects need rebuilding.

CREATE OR REPLACE VIEW "v_monthly_summary" AS
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
         SUM("quantityBags" * ("ratePerBag" + "loadingChargePerBag")) AS revenue,
         SUM("quantityBags" * "loadingChargePerBag") AS loading_charges,
         CASE WHEN SUM("quantityBags") > 0
              THEN ROUND(SUM("quantityBags" * ("ratePerBag" + "loadingChargePerBag")) / SUM("quantityBags"), 2)
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
    + COALESCE(e.expenses, 0) + COALESCE(el.electricity_cost, 0)
    + COALESCE(s.loading_charges, 0) AS total_cost,
  COALESCE(s.revenue, 0)
    - (COALESCE(m.sawdust_cost, 0) + COALESCE(m.chips_cost, 0) + COALESCE(l.labor_cost, 0)
       + COALESCE(e.expenses, 0) + COALESCE(el.electricity_cost, 0)
       + COALESCE(s.loading_charges, 0)) AS profit
FROM months mo
LEFT JOIN sales s ON s.month = mo.month
LEFT JOIN mat   m ON m.month = mo.month
LEFT JOIN prod  p ON p.month = mo.month
LEFT JOIN labor l ON l.month = mo.month
LEFT JOIN exp   e ON e.month = mo.month
LEFT JOIN elec el ON el.month = mo.month;

CREATE OR REPLACE VIEW v_daily_summary AS
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
         SUM("quantityBags" * ("ratePerBag" + "loadingChargePerBag")) AS revenue,
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
    + COALESCE(e.expenses, 0) + COALESCE(el.electricity_cost, 0)
    + COALESCE(s.loading_charges, 0) AS total_cost,
  COALESCE(s.revenue, 0)
    - (COALESCE(m.sawdust_cost, 0) + COALESCE(m.chips_cost, 0) + COALESCE(l.labor_cost, 0)
       + COALESCE(e.expenses, 0) + COALESCE(el.electricity_cost, 0)
       + COALESCE(s.loading_charges, 0)) AS profit
FROM days dd
LEFT JOIN sales s ON s.day = dd.day
LEFT JOIN mat   m ON m.day = dd.day
LEFT JOIN prod  p ON p.day = dd.day
LEFT JOIN labor l ON l.day = dd.day
LEFT JOIN exp   e ON e.day = dd.day
LEFT JOIN elec el ON el.day = dd.day;
