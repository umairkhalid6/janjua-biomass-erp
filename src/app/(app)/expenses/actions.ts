"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";
import { binderCategory, isToraCategory, TORA_CATEGORY } from "@/lib/constants";

export type ActionState = { error?: string; ok?: string };

// Binder categories (Sheera, Lime Powder) must carry the weight bought, and
// Tora must carry the number of bags bought; every other category stores null
// for both even if a stale value was posted.
type ParsedCategory = {
  category: string;
  quantityKg: number | null;
  toraBags: number | null;
};

function parseCategoryAndQuantity(
  formData: FormData,
): ParsedCategory | { error: string } {
  const raw = String(formData.get("category") ?? "").trim();
  if (isToraCategory(raw)) {
    const bagsStr = String(formData.get("toraBags") ?? "").trim();
    const bags = Number(bagsStr);
    if (!bagsStr || !Number.isInteger(bags) || bags <= 0)
      return { error: "Number of tora (bags) is required for Tora." };
    return { category: TORA_CATEGORY, quantityKg: null, toraBags: bags };
  }
  const binder = binderCategory(raw);
  if (!binder) return { category: raw, quantityKg: null, toraBags: null };
  const kgStr = String(formData.get("quantityKg") ?? "").trim();
  const kg = parseFloat(kgStr);
  if (!kgStr || isNaN(kg) || kg <= 0)
    return { error: `Weight (kg) is required for ${binder}.` };
  return { category: binder, quantityKg: kg, toraBags: null };
}

export async function createExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const dateStr = String(formData.get("date") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();

  if (!dateStr) return { error: "Date is required." };
  if (!item) return { error: "Item description is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };

  const parsed = parseCategoryAndQuantity(formData);
  if ("error" in parsed) return parsed;
  const { category, quantityKg, toraBags } = parsed;

  const date = parseDateInput(dateStr);

  await prisma.expense.create({
    data: { date, item, amount, category, quantityKg, toraBags },
  });

  revalidatePath("/expenses");
  return { ok: "Expense recorded." };
}

export async function updateExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();

  if (!id) return { error: "Expense ID missing." };
  if (!dateStr) return { error: "Date is required." };
  if (!item) return { error: "Item description is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };

  const parsed = parseCategoryAndQuantity(formData);
  if ("error" in parsed) return parsed;
  const { category, quantityKg, toraBags } = parsed;

  const date = parseDateInput(dateStr);

  await prisma.expense.update({
    where: { id },
    data: { date, item, amount, category, quantityKg, toraBags },
  });

  revalidatePath("/expenses");
  return { ok: "Expense updated." };
}

export async function deleteExpense(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/expenses");
}
