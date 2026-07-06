-- Rename Vendor -> Supplier (data-preserving), add opening balances, customer
-- receipts, payment methods, and invoice share tokens. Rebuild the customer and
-- supplier ledgers as running-balance transaction views (like v_contractor_ledger).

-- 1. Drop the ledger views that reference the tables being renamed
--    (recreated at the end with the new transaction-ledger shape).
DROP VIEW IF EXISTS "v_vendor_ledger";
DROP VIEW IF EXISTS "v_customer_ledger";

-- 2. Rename tables.
ALTER TABLE "vendors" RENAME TO "suppliers";
ALTER TABLE "vendor_payments" RENAME TO "supplier_payments";

-- 3. Rename FK columns.
ALTER TABLE "material_purchases" RENAME COLUMN "vendorId" TO "supplierId";
ALTER TABLE "supplier_payments" RENAME COLUMN "vendorId" TO "supplierId";

-- 4. Rename constraints & indexes to match Prisma's naming conventions.
ALTER TABLE "suppliers" RENAME CONSTRAINT "vendors_pkey" TO "suppliers_pkey";
ALTER TABLE "supplier_payments" RENAME CONSTRAINT "vendor_payments_pkey" TO "supplier_payments_pkey";
ALTER TABLE "material_purchases" RENAME CONSTRAINT "material_purchases_vendorId_fkey" TO "material_purchases_supplierId_fkey";
ALTER TABLE "supplier_payments" RENAME CONSTRAINT "vendor_payments_vendorId_fkey" TO "supplier_payments_supplierId_fkey";
ALTER INDEX "vendor_payments_date_idx" RENAME TO "supplier_payments_date_idx";

-- 5. Opening balances + payment method.
ALTER TABLE "suppliers" ADD COLUMN "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "customers" ADD COLUMN "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "supplier_payments" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'Cash';

-- 6. Customer receipts (money received against outstanding balance).
CREATE TABLE "customer_payments" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'Cash',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_payments_date_idx" ON "customer_payments"("date");
ALTER TABLE "customer_payments"
    ADD CONSTRAINT "customer_payments_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Public invoice share token (WhatsApp link).
ALTER TABLE "pellet_sales" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "pellet_sales_shareToken_key" ON "pellet_sales"("shareToken");

-- 8. Customer running-balance ledger (receivables).
--    Opening balance + each sale (debit) + each receipt (credit), with a running
--    balance per customer. Positive balance = customer owes us.
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
    (s."quantityBags" * s."ratePerBag")
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

-- 9. Customer summary (one row per customer) for the list page.
CREATE VIEW "v_customer_summary" AS
SELECT
  c.id                                                          AS customer_id,
  c.name,
  c.company,
  c.phone,
  c."openingBalance"                                            AS opening_balance,
  COALESCE(sale.total_sales, 0)                                 AS total_sales,
  COALESCE(sale.sales_count, 0)                                 AS sales_count,
  COALESCE(sale.total_bags, 0)                                  AS total_bags,
  sale.last_sale_date,
  COALESCE(pay.total_paid, 0)                                   AS total_paid,
  pay.last_payment_date,
  c."openingBalance" + COALESCE(sale.total_sales, 0) - COALESCE(pay.total_paid, 0) AS outstanding
FROM customers c
LEFT JOIN (
  SELECT "customerId",
         SUM("quantityBags" * "ratePerBag") AS total_sales,
         COUNT(*)                           AS sales_count,
         SUM("quantityBags")                AS total_bags,
         MAX(date)                          AS last_sale_date
  FROM pellet_sales GROUP BY 1
) sale ON sale."customerId" = c.id
LEFT JOIN (
  SELECT "customerId",
         SUM(amount) AS total_paid,
         MAX(date)   AS last_payment_date
  FROM customer_payments GROUP BY 1
) pay ON pay."customerId" = c.id;

-- 10. Supplier running-balance ledger (payables).
--     Opening balance + each purchase (debit = we owe) + each payment (credit).
--     Positive balance = we owe the supplier.
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
    COALESCE(NULLIF(sp.notes, ''), 'Payment (' || sp.method || ')'),
    -sp.amount
  FROM supplier_payments sp
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

-- 11. Supplier summary (one row per supplier) for the list page.
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
         SUM("materialCost" + "handlingCost") AS total_purchased,
         MAX(date)                            AS last_purchase_date
  FROM material_purchases GROUP BY 1
) pur ON pur."supplierId" = s.id
LEFT JOIN (
  SELECT "supplierId",
         SUM(amount) AS total_paid,
         MAX(date)   AS last_payment_date
  FROM supplier_payments GROUP BY 1
) pay ON pay."supplierId" = s.id;
