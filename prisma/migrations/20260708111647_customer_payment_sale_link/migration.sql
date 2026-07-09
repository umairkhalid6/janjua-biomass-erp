-- AlterTable
ALTER TABLE "customer_payments" ADD COLUMN     "saleId" TEXT;

-- CreateIndex
CREATE INDEX "customer_payments_saleId_idx" ON "customer_payments"("saleId");

-- AddForeignKey
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "pellet_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rebuild the customer ledger so a payment received against a specific
-- invoice is described as such ("Payment — INV-00006 (Cash)"). Only the
-- PAYMENT branch's description changes; amounts and ordering are unchanged.
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
    CASE
      WHEN ps.id IS NOT NULL THEN
        'Payment — INV-' || lpad(ps."invoiceNo"::text, 5, '0')
          || ' (' || p.method || ')'
          || COALESCE(' — ' || NULLIF(p.notes, ''), '')
      ELSE COALESCE(NULLIF(p.notes, ''), 'Payment (' || p.method || ')')
    END,
    -p.amount
  FROM customer_payments p
  LEFT JOIN pellet_sales ps ON ps.id = p."saleId"
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
