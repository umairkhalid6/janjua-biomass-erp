// Pellets are packed in 40-kg or 50-kg bags. Production (per shift) and sales
// (per sale) record which size was used; weight = bags × that size. BAG_KG is
// the default size, used for rows entered before the size was recorded.
export const BAG_KG = 40;
export const BAG_SIZES = [40, 50] as const;
export type BagSize = (typeof BAG_SIZES)[number];

// Parses a submitted bag size; anything other than an allowed size is null.
export function parseBagSize(value: unknown): BagSize | null {
  const n = Number(String(value ?? "").trim());
  return (BAG_SIZES as readonly number[]).includes(n) ? (n as BagSize) : null;
}

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

// Expense category for tora (empty bags) purchases. Its expenses must record
// how many bags were bought (toraBags); matched case-insensitively.
export const TORA_CATEGORY = "Tora";

export function isToraCategory(category: string): boolean {
  return category.trim().toLowerCase() === TORA_CATEGORY.toLowerCase();
}
