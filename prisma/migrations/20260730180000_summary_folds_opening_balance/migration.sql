-- Opening balance stops being a card of its own and folds, by sign, into the
-- two figures it belongs to. An advance paid to a supplier before the system
-- existed is money paid — it belongs in Total Paid, not in a separate box the
-- owner has to add up mentally. A debt carried in is money owed — it belongs
-- in Total Payable. Same, mirrored, for customers.
--
-- The raw columns (opening_balance, total_purchased/total_sales, total_paid)
-- stay, so anything needing record-true figures — period reports, ties back to
-- the payments table — keeps them. balance_owed / outstanding are unchanged:
-- opening + purchased - paid is exactly total_payable - total_paid_all.
--
-- Deliberately NOT touched: v_purchase_settlement. Its FIFO pool already nets
-- the opening balance out of available payments; folding it a second time here
-- would double-count and flip purchase badges.

DROP VIEW "v_supplier_summary";
CREATE VIEW "v_supplier_summary" AS
SELECT
  s.id                                                            AS supplier_id,
  s.name,
  s.phone,
  s."openingBalance"                                              AS opening_balance,
  GREATEST(s."openingBalance", 0)                                 AS opening_owed,
  GREATEST(-s."openingBalance", 0)                                AS opening_advance,
  COALESCE(pur.total_purchased, 0)                                AS total_purchased,
  COALESCE(pur.total_purchased, 0) + GREATEST(s."openingBalance", 0)
                                                                  AS total_payable,
  pur.last_purchase_date,
  COALESCE(pay.total_paid, 0)                                     AS total_paid,
  COALESCE(pay.total_paid, 0) + GREATEST(-s."openingBalance", 0)  AS total_paid_all,
  pay.last_payment_date,
  s."openingBalance" + COALESCE(pur.total_purchased, 0) - COALESCE(pay.total_paid, 0) AS balance_owed
FROM suppliers s
LEFT JOIN (
  SELECT "supplierId",
         SUM("materialCost") AS total_purchased,
         MAX(date)           AS last_purchase_date
  FROM material_purchases GROUP BY 1
) pur ON pur."supplierId" = s.id
LEFT JOIN (
  SELECT "supplierId",
         SUM(amount) AS total_paid,
         MAX(date)   AS last_payment_date
  FROM supplier_payments GROUP BY 1
) pay ON pay."supplierId" = s.id;

-- Customers mirror it: a positive opening is what they already owed us
-- (receivable), a negative opening is an advance they had already paid us.
DROP VIEW "v_customer_summary";
CREATE VIEW "v_customer_summary" AS
SELECT
  c.id                                                          AS customer_id,
  c.name,
  c.company,
  c.phone,
  c."openingBalance"                                            AS opening_balance,
  GREATEST(c."openingBalance", 0)                               AS opening_receivable,
  GREATEST(-c."openingBalance", 0)                              AS opening_advance,
  COALESCE(sale.total_sales, 0)                                 AS total_sales,
  COALESCE(sale.total_sales, 0) + GREATEST(c."openingBalance", 0)
                                                                AS total_billed,
  COALESCE(sale.total_loading, 0)                               AS total_loading,
  COALESCE(sale.sales_count, 0)                                 AS sales_count,
  COALESCE(sale.total_bags, 0)                                  AS total_bags,
  sale.last_sale_date,
  COALESCE(pay.total_paid, 0)                                   AS total_paid,
  COALESCE(pay.total_paid, 0) + GREATEST(-c."openingBalance", 0) AS total_received_all,
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
