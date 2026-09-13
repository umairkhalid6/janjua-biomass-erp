"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string };

// Payments and adjustments each use one save action: a hidden `id` field
// (sent only by the edit dialogs) turns the create into an update.

const MISSING = { error: "This entry no longer exists — it may have been deleted." };

export async function createPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!dateStr) return { error: "Date is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };

  const date = parseDateInput(dateStr);
  const data = { date, amount, notes: notes || null };

  try {
    if (id) {
      await prisma.contractorPayment.update({ where: { id }, data });
    } else {
      await prisma.contractorPayment.create({ data });
    }
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2025") return MISSING;
    throw err;
  }

  revalidatePath("/contractor");
  revalidatePath("/reports/contractor");
  return { ok: id ? "Payment updated." : "Payment recorded." };
}

export async function createAdjustment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!dateStr) return { error: "Date is required." };
  if (!amountStr) return { error: "Amount is required." };
  if (direction !== "paying" && direction !== "receiving")
    return { error: "Select whether you are paying or receiving." };
  if (!reason) return { error: "Reason is required." };

  const magnitude = parseFloat(amountStr);
  if (isNaN(magnitude) || magnitude <= 0)
    return { error: "Amount must be a positive number." };

  // Paying the contractor raises what he owes us (negative balance);
  // receiving from him lowers it (positive balance).
  const amount = direction === "paying" ? -magnitude : magnitude;

  const date = parseDateInput(dateStr);
  const data = { date, amount, reason };

  try {
    if (id) {
      await prisma.contractorAdjustment.update({ where: { id }, data });
    } else {
      await prisma.contractorAdjustment.create({ data });
    }
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "P2002") {
      return { error: "An adjustment with this date and reason already exists." };
    }
    if (e?.code === "P2025") return MISSING;
    throw err;
  }

  revalidatePath("/contractor");
  revalidatePath("/reports/contractor");
  return { ok: id ? "Adjustment updated." : "Adjustment recorded." };
}

export async function deletePayment(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.contractorPayment.deleteMany({ where: { id } });
  revalidatePath("/contractor");
  revalidatePath("/reports/contractor");
}

export async function deleteAdjustment(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.contractorAdjustment.deleteMany({ where: { id } });
  revalidatePath("/contractor");
  revalidatePath("/reports/contractor");
}
