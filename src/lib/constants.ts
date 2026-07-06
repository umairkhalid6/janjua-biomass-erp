// One pellet bag weighs 40 kg. Production and sales are recorded in bags;
// material purchases are recorded in KG. Keep in sync with the SQL views
// (prisma/migrations/*_report_views), which hardcode 40.
export const BAG_KG = 40;

export const CURRENCY = "PKR";

export const MATERIAL_LABELS: Record<string, string> = {
  POPLAR: "Poplar Sawdust",
  HARDWOOD: "Hardwood Sawdust",
  HAIDERI_PLYWOOD: "Haideri Plywood Sawdust",
  WOOD_CHIPS: "Wood Chips",
};
