"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string };

export async function createExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const dateStr = String(formData.get("date") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!dateStr) return { error: "Date is required." };
  if (!item) return { error: "Item description is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.expense.create({
    data: { date, item, amount, category },
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
  const category = String(formData.get("category") ?? "").trim();

  if (!id) return { error: "Expense ID missing." };
  if (!dateStr) return { error: "Date is required." };
  if (!item) return { error: "Item description is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.expense.update({
    where: { id },
    data: { date, item, amount, category },
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
