// One pellet bag weighs 40 kg. Production and sales are recorded in bags;
// material purchases are recorded in KG. Keep in sync with the SQL views
// (prisma/migrations/*_report_views), which hardcode 40.
export const BAG_KG = 40;

export const CURRENCY = "PKR";

// Every bag sold carries a fixed loading charge, included in the price the
// user types in (and in the invoice total) but stored separately: a sale
// entered at 2,500/bag is saved as ratePerBag 2,490 + loadingChargePerBag 10.
export const LOADING_CHARGE_PER_BAG = 10;

export const MATERIAL_LABELS: Record<string, string> = {
  POPLAR: "Poplar Sawdust",
  HARDWOOD: "Hardwood Sawdust",
  HAIDERI_PLYWOOD: "Haideri Plywood Sawdust",
  WOOD_CHIPS: "Wood Chips",
};
