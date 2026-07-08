-- Split the fixed Rs 10/bag loading charge out of the sale rate.
-- The user keeps entering ONE customer-facing price (e.g. 2,500/bag); the app
-- now stores it as ratePerBag 2,490 (net pellet price) + loadingChargePerBag 10.
-- Invoices/ledgers keep billing the gross rate (net + loading), so customer
-- balances are unchanged; reports gain the pellet/loading split.

-- AlterTable
ALTER TABLE "pellet_sales" ADD COLUMN     "loadingChargePerBag" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill: loading always applied physically, so historical rates also
-- contained the Rs 10/bag charge. Splitting them keeps every gross amount
-- (invoice totals, ledger balances) identical.
UPDATE "pellet_sales"
SET "ratePerBag" = "ratePerBag" - 10,
    "loadingChargePerBag" = 10
WHERE "ratePerBag" > 10;

-- Rebuild the customer running-balance ledger: a sale debits the GROSS amount
-- (net + loading) — that is what the customer owes. (DROP + CREATE because the
-- view body changes; columns are unchanged.)
DROP VIEW "v_customer_ledger";
CREATE VIEW "v_customer_ledger" AS
WITH entries AS (
  SELECT
    c.id                                        AS customer_id,
    c.id || ':opening'                          AS entry_id,
    NULL::date                                  AS date,
    0                                           AS sort_order,
    'OPENING'::text                             AS entry_type,
    'Opening balance'::text                     AS description,
    c."openingBalance"                          AS amount
  FROM customers c
  WHERE c."openingBalance" <> 0
  UNION ALL
  SELECT
    s."customerId",
    s.id,
    s.date,
    1,
    'SALE',
    'Invoice INV-' || lpad(s."invoiceNo"::text, 5, '0'),
    (s."quantityBags" * (s."ratePerBag" + s."loadingChargePerBag"))
  FROM pellet_sales s
  UNION ALL
  SELECT
    p."customerId",
    p.id,
    p.date,
    2,
    'PAYMENT',
    COALESCE(NULLIF(p.notes, ''), 'Payment (' || p.method || ')'),
    -p.amount
  FROM customer_payments p
)
SELECT
  customer_id,
  entry_id,
  date,
  entry_type,
  description,
  CASE WHEN amount >= 0 THEN amount ELSE 0 END      AS debit,
  CASE WHEN amount <  0 THEN -amount ELSE 0 END     AS credit,
  amount,
  SUM(amount) OVER (
    PARTITION BY customer_id
    ORDER BY date NULLS FIRST, sort_order, entry_id
    ROWS UNBOUNDED PRECEDING
  )                                                 AS balance
FROM entries;

-- Rebuild the customer summary: total_sales stays GROSS (drives outstanding);
-- new total_loading column reports the loading share separately.
DROP VIEW "v_customer_summary";
CREATE VIEW "v_customer_summary" AS
SELECT
  c.id                                                          AS customer_id,
  c.name,
  c.company,
  c.phone,
  c."openingBalance"                                            AS opening_balance,
  COALESCE(sale.total_sales, 0)                                 AS total_sales,
  COALESCE(sale.total_loading, 0)                               AS total_loading,
  COALESCE(sale.sales_count, 0)                                 AS sales_count,
  COALESCE(sale.total_bags, 0)                                  AS total_bags,
  sale.last_sale_date,
  COALESCE(pay.total_paid, 0)                                   AS total_paid,
  pay.last_payment_date,
  c."openingBalance" + COALESCE(sale.total_sales, 0) - COALESCE(pay.total_paid, 0) AS outstanding
FROM customers c
LEFT JOIN (
  SELECT "customerId",
         SUM("quantityBags" * ("ratePerBag" + "loadingChargePerBag")) AS total_sales,
         SUM("quantityBags" * "loadingChargePerBag")                  AS total_loading,
         COUNT(*)                                                     AS sales_count,
         SUM("quantityBags")                                          AS total_bags,
         MAX(date)                                                    AS last_sale_date
  FROM pellet_sales GROUP BY 1
) sale ON sale."customerId" = c.id
LEFT JOIN (
  SELECT "customerId",
         SUM(amount) AS total_paid,
         MAX(date)   AS last_payment_date
  FROM customer_payments GROUP BY 1
) pay ON pay."customerId" = c.id;

-- Rebuild the monthly P&L: sales_revenue is now NET pellet revenue (loading
-- excluded); loading_charges is reported as its own pass-through column and
-- stays out of the profit calculation.
DROP VIEW "v_monthly_summary";
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
