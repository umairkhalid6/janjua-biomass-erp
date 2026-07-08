"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string };

export async function upsertProductionDay(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const dateStr = String(formData.get("date") ?? "").trim();
  const shift = String(formData.get("shift") ?? "") === "NIGHT" ? "NIGHT" : "DAY";
  const bagsStr = String(formData.get("bags") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!dateStr) return { error: "Date is required." };
  if (bagsStr === "") return { error: "Bag count is required." };

  const bags = parseFloat(bagsStr);
  if (isNaN(bags) || bags < 0)
    return { error: "Bags must be a non-negative number." };

  const date = parseDateInput(dateStr);
  const shiftField =
    shift === "DAY" ? { dayShiftBags: bags } : { nightShiftBags: bags };

  // One row per date; saving a shift only touches that shift's column so the
  // other shift's entry for the same day is preserved.
  await prisma.productionDay.upsert({
    where: { date },
    create: {
      date,
      dayShiftBags: shift === "DAY" ? bags : 0,
      nightShiftBags: shift === "NIGHT" ? bags : 0,
      notes: notes || null,
      createdById: user.id,
    },
    update: {
      ...shiftField,
      ...(notes ? { notes } : {}),
      updatedById: user.id,
    },
  });

  revalidatePath("/production");
  return {
    ok: `${shift === "DAY" ? "Day" : "Night"} shift saved.`,
  };
}

export async function deleteProductionDay(formData: FormData): Promise<void> {
  // Operators add + edit production; only admins may delete a day's record.
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.productionDay.delete({ where: { id } });
  revalidatePath("/production");
}
