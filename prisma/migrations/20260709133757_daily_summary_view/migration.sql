-- Day-grain P&L summary powering the Daily / Weekly / Monthly chart
-- granularity switcher. Mirrors v_monthly_summary but buckets by calendar
-- day, so pages can re-aggregate to any grain with
-- date_trunc('day'|'week'|'month', day).
--
-- Electricity bills are recorded per month with no day component, so each
-- bill lands entirely on the 1st of its month: daily/weekly profit buckets
-- containing a month's 1st carry that month's whole electricity cost.
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
