"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string };

export async function upsertProductionDay(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const dateStr = String(formData.get("date") ?? "").trim();
  const dayShift = String(formData.get("dayShiftBags") ?? "").trim();
  const nightShift = String(formData.get("nightShiftBags") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!dateStr) return { error: "Date is required." };
  if (dayShift === "" && nightShift === "")
    return { error: "At least one shift bag count is required." };

  const dayShiftBags = parseFloat(dayShift || "0");
  const nightShiftBags = parseFloat(nightShift || "0");

  if (isNaN(dayShiftBags) || dayShiftBags < 0)
    return { error: "Day shift bags must be a non-negative number." };
  if (isNaN(nightShiftBags) || nightShiftBags < 0)
    return { error: "Night shift bags must be a non-negative number." };

  const date = parseDateInput(dateStr);

  await prisma.productionDay.upsert({
    where: { date },
    create: {
      date,
      dayShiftBags,
      nightShiftBags,
      notes: notes || null,
    },
    update: {
      dayShiftBags,
      nightShiftBags,
      notes: notes || null,
    },
  });

  revalidatePath("/production");
  return { ok: "Production day saved." };
}

export async function deleteProductionDay(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.productionDay.delete({ where: { id } });
  revalidatePath("/production");
}
