-- Per-purchase Paid/Partial/Unpaid is derived by FIFO settlement, not by
-- which payment row happens to be linked to which purchase. Pool = all
-- payments for the supplier (negative DR-adjustment rows net out via SUM).
-- A positive opening balance is older debt that consumes the pool first; a
-- negative opening balance is an advance that adds to it — both collapse to:
-- available = total_paid - openingBalance.
-- Payable is materialCost only; handling cost never enters supplier balances.
CREATE VIEW "v_purchase_settlement" AS
WITH pool AS (
  SELECT s.id AS supplier_id,
         COALESCE(pay.total_paid, 0) - s."openingBalance" AS available
  FROM suppliers s
  LEFT JOIN (
    SELECT "supplierId", SUM(amount) AS total_paid
    FROM supplier_payments GROUP BY 1
  ) pay ON pay."supplierId" = s.id
),
ordered AS (
  SELECT mp.id, mp."supplierId", mp.date, mp."materialCost",
         SUM(mp."materialCost") OVER (
           PARTITION BY mp."supplierId"
           ORDER BY mp.date, mp."createdAt", mp.id
           ROWS UNBOUNDED PRECEDING
         ) - mp."materialCost" AS prior_cost
  FROM material_purchases mp
)
SELECT
  o.id                             AS purchase_id,
  o."supplierId"                   AS supplier_id,
  o.date,
  o."materialCost"                 AS material_cost,
  GREATEST(LEAST(p.available - o.prior_cost, o."materialCost"), 0) AS settled_amount,
  CASE
    WHEN GREATEST(LEAST(p.available - o.prior_cost, o."materialCost"), 0)
         >= o."materialCost" - 0.005 THEN 'paid'
    WHEN GREATEST(LEAST(p.available - o.prior_cost, o."materialCost"), 0)
         > 0.005 THEN 'partial'
    ELSE 'unpaid'
  END                              AS status
FROM ordered o
JOIN pool p ON p.supplier_id = o."supplierId";
