-- Tora (empty bag) purchases record how many bags were bought so the cost per
-- bag can be tracked. Null for all other expenses.
ALTER TABLE "expenses" ADD COLUMN "toraBags" INTEGER;
