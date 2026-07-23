-- Supplier payables count material cost only. Handling cost (unloading/gari)
-- is the owner's own expense, paid to laborers/transporters — never owed to
-- the supplier. Total-cost reporting views (v_material_totals,
-- v_monthly_summary, v_daily_summary) intentionally keep
-- materialCost + handlingCost, as does ratePerKg.

-- 1) Data fix (owner-approved): purchases saved as PAID created a linked
--    payment of material + handling. Reduce those payments by the purchase's
--    handling cost so suppliers don't show as overpaid once payables become
--    material-only. The amount > materialCost guard leaves genuine partial
--    payments (which never covered handling) untouched.
UPDATE supplier_payments sp
SET amount = GREATEST(sp.amount - mp."handlingCost", 0)
FROM material_purchases mp
WHERE mp.id = sp."purchaseId"
  AND sp.amount > mp."materialCost";

-- A payment that only ever covered the handling portion drops to zero — no
-- money actually went to the supplier, so remove the row entirely.
DELETE FROM supplier_payments
WHERE "purchaseId" IS NOT NULL AND amount = 0;

-- 2) Rebuild the supplier ledger: PURCHASE debit is materialCost only.
DROP VIEW "v_supplier_ledger";
CREATE VIEW "v_supplier_ledger" AS
WITH entries AS (
  SELECT
    s.id                                        AS supplier_id,
    s.id || ':opening'                          AS entry_id,
    NULL::date                                  AS date,
    0                                           AS sort_order,
    'OPENING'::text                             AS entry_type,
    'Opening balance'::text                     AS description,
    s."openingBalance"                          AS amount
  FROM suppliers s
  WHERE s."openingBalance" <> 0
  UNION ALL
  SELECT
    mp."supplierId",
    mp.id,
    mp.date,
    1,
    'PURCHASE',
    'Purchase: ' || mp."materialType" || ' (' || mp."weightKg" || ' kg)',
    mp."materialCost"
  FROM material_purchases mp
  UNION ALL
  SELECT
    sp."supplierId",
    sp.id,
    sp.date,
    2,
    'PAYMENT',
    CASE
      WHEN mp.id IS NOT NULL THEN
        'Payment — Purchase: ' || mp."materialType" || ' ' || to_char(mp.date, 'DD-Mon-YYYY')
          || ' (' || sp.method || ')'
          || COALESCE(' — ' || NULLIF(sp.notes, ''), '')
      ELSE COALESCE(NULLIF(sp.notes, ''), 'Payment (' || sp.method || ')')
    END,
    -sp.amount
  FROM supplier_payments sp
  LEFT JOIN material_purchases mp ON mp.id = sp."purchaseId"
)
SELECT
  supplier_id,
  entry_id,
  date,
  entry_type,
  description,
  CASE WHEN amount >= 0 THEN amount ELSE 0 END      AS debit,
  CASE WHEN amount <  0 THEN -amount ELSE 0 END     AS credit,
  amount,
  SUM(amount) OVER (
    PARTITION BY supplier_id
    ORDER BY date NULLS FIRST, sort_order, entry_id
    ROWS UNBOUNDED PRECEDING
  )                                                 AS balance
FROM entries;

-- 3) Rebuild the supplier summary: total_purchased is materialCost only.
DROP VIEW "v_supplier_summary";
CREATE VIEW "v_supplier_summary" AS
SELECT
  s.id                                                            AS supplier_id,
  s.name,
  s.phone,
  s."openingBalance"                                              AS opening_balance,
  COALESCE(pur.total_purchased, 0)                                AS total_purchased,
  pur.last_purchase_date,
  COALESCE(pay.total_paid, 0)                                     AS total_paid,
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
