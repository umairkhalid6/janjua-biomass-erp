"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseMonthParam } from "@/lib/format";

export type ActionState = { error?: string; ok?: string };

export async function upsertElectricityBill(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const monthStr = String(formData.get("month") ?? "").trim();
  const billStr = String(formData.get("billAmount") ?? "").trim();
  const unitsStr = String(formData.get("unitsConsumed") ?? "").trim();

  if (!monthStr) return { error: "Month is required." };
  if (!billStr || !unitsStr) return { error: "Bill amount and units consumed are required." };

  const billAmount = parseFloat(billStr);
  const unitsConsumed = parseFloat(unitsStr);

  if (isNaN(billAmount) || billAmount <= 0)
    return { error: "Bill amount must be a positive number." };
  if (isNaN(unitsConsumed) || unitsConsumed <= 0)
    return { error: "Units consumed must be a positive number." };

  // Store as the 1st of the month (UTC midnight)
  const month = parseMonthParam(monthStr);

  await prisma.electricityBill.upsert({
    where: { month },
    create: { month, billAmount, unitsConsumed },
    update: { billAmount, unitsConsumed },
  });

  revalidatePath("/electricity");
  return { ok: "Electricity bill saved." };
}

export async function deleteElectricityBill(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.electricityBill.delete({ where: { id } });
  revalidatePath("/electricity");
}
