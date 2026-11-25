-- Pellets are now packed in 40-kg OR 50-kg bags.
--
-- Production records the bag size per shift (dayBagKg / nightBagKg) and each
-- sale records the size sold (bagKg). Every existing row was a 40-kg bag, so
-- the columns default to 40 and history is unchanged.
ALTER TABLE "production_days" ADD COLUMN "dayBagKg"   INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "production_days" ADD COLUMN "nightBagKg" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "pellet_sales"    ADD COLUMN "bagKg"      INTEGER NOT NULL DEFAULT 40;

ALTER TABLE "production_days" ADD CONSTRAINT "production_days_dayBagKg_check"   CHECK ("dayBagKg"   IN (40, 50));
ALTER TABLE "production_days" ADD CONSTRAINT "production_days_nightBagKg_check" CHECK ("nightBagKg" IN (40, 50));
ALTER TABLE "pellet_sales"    ADD CONSTRAINT "pellet_sales_bagKg_check"         CHECK ("bagKg"      IN (40, 50));

-- Labor is paid per kg, so each shift is now costed on bags × that shift's bag
-- size instead of a hardcoded 40. Existing columns keep their names, order and
-- types (CREATE OR REPLACE, no cascade); day_kg / night_kg / kg are appended.
CREATE OR REPLACE VIEW v_labor_daily AS
SELECT
  p.date,
  (p."dayShiftBags" + p."nightShiftBags")                                        AS bags,
  p."dayShiftBags"                                                               AS day_bags,
  p."nightShiftBags"                                                             AS night_bags,
  COALESCE(r."dayRatePerKg", 0)                                                  AS day_rate_per_kg,
  COALESCE(r."nightRatePerKg", 0)                                                AS night_rate_per_kg,
  ROUND(p."dayShiftBags"   * p."dayBagKg"   * COALESCE(r."dayRatePerKg", 0), 2)  AS day_labor_cost,
  ROUND(p."nightShiftBags" * p."nightBagKg" * COALESCE(r."nightRatePerKg", 0), 2) AS night_labor_cost,
  ROUND(p."dayShiftBags"   * p."dayBagKg"   * COALESCE(r."dayRatePerKg", 0), 2)
    + ROUND(p."nightShiftBags" * p."nightBagKg" * COALESCE(r."nightRatePerKg", 0), 2) AS labor_cost,
  p."dayShiftBags"   * p."dayBagKg"                                              AS day_kg,
  p."nightShiftBags" * p."nightBagKg"                                            AS night_kg,
  p."dayShiftBags" * p."dayBagKg" + p."nightShiftBags" * p."nightBagKg"          AS kg
FROM production_days p
LEFT JOIN LATERAL (
  SELECT "dayRatePerKg", "nightRatePerKg"
  FROM contractor_rates
  WHERE "effectiveFrom" <= p.date
  ORDER BY "effectiveFrom" DESC
  LIMIT 1
) r ON true;

CREATE OR REPLACE VIEW v_production_summary AS
SELECT
  date_trunc('month', date)::date                                      AS month,
  SUM("dayShiftBags")                                                  AS day_shift_bags,
  SUM("nightShiftBags")                                                AS night_shift_bags,
  SUM("dayShiftBags" + "nightShiftBags")                               AS total_bags,
  SUM("dayShiftBags" * "dayBagKg" + "nightShiftBags" * "nightBagKg")   AS total_kg
FROM production_days
GROUP BY 1;
