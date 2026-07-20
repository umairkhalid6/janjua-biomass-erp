-- AlterTable
ALTER TABLE "supplier_payments" ADD COLUMN     "purchaseId" TEXT;

-- CreateIndex
CREATE INDEX "supplier_payments_purchaseId_idx" ON "supplier_payments"("purchaseId");

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "material_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rebuild the supplier ledger so a payment made against a specific purchase
-- is described as such ("Payment — Purchase: POPLAR 12-Jul-2026 (Cash)"),
-- mirroring how v_customer_ledger describes invoice-linked receipts. Only the
-- PAYMENT branch's description changes; amounts and ordering are unchanged.
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
    (mp."materialCost" + mp."handlingCost")
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
