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

// Expense categories that record the weight bought (quantityKg). The kg field
// is shown and required only for these; matched case-insensitively.
export const BINDER_CATEGORIES = ["Sheera", "Lime Powder"] as const;

// Returns the canonical binder category name ("Sheera" / "Lime Powder") for any
// casing of it, or null when the category is not a binder.
export function binderCategory(category: string): string | null {
  const c = category.trim().toLowerCase();
  return BINDER_CATEGORIES.find((b) => b.toLowerCase() === c) ?? null;
}
