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

  // One row per date, but day and night shifts are independent entries. Each
  // shift keeps its own audit trail: the first save for a shift records its
  // creator; later saves for that same shift record the editor.
  const existing = await prisma.productionDay.findUnique({
    where: { date },
    select: { dayCreatedById: true, nightCreatedById: true },
  });

  const shiftAlreadyEntered =
    shift === "DAY"
      ? Boolean(existing?.dayCreatedById)
      : Boolean(existing?.nightCreatedById);

  const shiftAudit = shiftAlreadyEntered
    ? shift === "DAY"
      ? { dayUpdatedById: user.id, dayUpdatedAt: new Date() }
      : { nightUpdatedById: user.id, nightUpdatedAt: new Date() }
    : shift === "DAY"
      ? { dayCreatedById: user.id }
      : { nightCreatedById: user.id };

  if (!existing) {
    await prisma.productionDay.create({
      data: {
        date,
        dayShiftBags: shift === "DAY" ? bags : 0,
        nightShiftBags: shift === "NIGHT" ? bags : 0,
        notes: notes || null,
        createdById: user.id,
        ...shiftAudit,
      },
    });
  } else {
    await prisma.productionDay.update({
      where: { date },
      data: {
        ...shiftField,
        ...(notes ? { notes } : {}),
        updatedById: user.id,
        ...shiftAudit,
      },
    });
  }

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
