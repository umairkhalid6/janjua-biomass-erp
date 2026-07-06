-- AlterTable
ALTER TABLE "material_purchases" ADD COLUMN     "ratePerKg" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill existing purchases: (materialCost + handlingCost) / weightKg
UPDATE "material_purchases"
SET "ratePerKg" = ROUND(("materialCost" + "handlingCost") / "weightKg", 2)
WHERE "weightKg" > 0;
