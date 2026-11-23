-- Binder purchases (Sheera, Lime) record the weight bought so cost per kg and
-- dose per tonne of pellets can be tracked. Null for all other expenses.
ALTER TABLE "expenses" ADD COLUMN "quantityKg" DECIMAL(12,2);
