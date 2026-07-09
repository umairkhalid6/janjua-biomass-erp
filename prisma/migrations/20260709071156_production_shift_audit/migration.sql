-- AlterTable
ALTER TABLE "production_days" ADD COLUMN     "dayCreatedById" TEXT,
ADD COLUMN     "dayUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "dayUpdatedById" TEXT,
ADD COLUMN     "nightCreatedById" TEXT,
ADD COLUMN     "nightUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "nightUpdatedById" TEXT;

-- AddForeignKey
ALTER TABLE "production_days" ADD CONSTRAINT "production_days_dayCreatedById_fkey" FOREIGN KEY ("dayCreatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_days" ADD CONSTRAINT "production_days_dayUpdatedById_fkey" FOREIGN KEY ("dayUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_days" ADD CONSTRAINT "production_days_nightCreatedById_fkey" FOREIGN KEY ("nightCreatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_days" ADD CONSTRAINT "production_days_nightUpdatedById_fkey" FOREIGN KEY ("nightUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill per-shift audit from the legacy whole-row fields. The old model only
-- tracked one creator/editor for the whole day, so attribute it to whichever
-- shift(s) actually have bags recorded. This is a best-effort seed of history.
UPDATE "production_days"
SET "dayCreatedById"   = "createdById",
    "dayUpdatedById"   = "updatedById",
    "dayUpdatedAt"     = CASE WHEN "updatedById" IS NOT NULL THEN "updatedAt" END
WHERE "dayShiftBags" > 0;

UPDATE "production_days"
SET "nightCreatedById" = "createdById",
    "nightUpdatedById" = "updatedById",
    "nightUpdatedAt"   = CASE WHEN "updatedById" IS NOT NULL THEN "updatedAt" END
WHERE "nightShiftBags" > 0;
