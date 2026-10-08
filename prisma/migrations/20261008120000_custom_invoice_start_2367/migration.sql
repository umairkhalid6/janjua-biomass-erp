-- Start standalone invoice numbering at 2367 (JB-02367) instead of 1.
-- If invoices already exist past that point, continue after the highest one
-- so no number is ever reused.
SELECT setval(
  pg_get_serial_sequence('custom_invoices', 'invoiceNo'),
  GREATEST(2366, COALESCE((SELECT MAX("invoiceNo") FROM "custom_invoices"), 0)),
  true
);
