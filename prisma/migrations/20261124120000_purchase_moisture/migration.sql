-- Moisture % (wet basis) measured when raw material is bought. Optional; null
-- when not measured. Used later for dry-weight cost analytics per supplier.
ALTER TABLE "material_purchases" ADD COLUMN "moisturePct" DECIMAL(5,2);
