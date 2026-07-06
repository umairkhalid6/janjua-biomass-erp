"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string };

export async function createPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const dateStr = String(formData.get("date") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!dateStr) return { error: "Date is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.contractorPayment.create({
    data: { date, amount, notes: notes || null },
  });

  revalidatePath("/contractor");
  return { ok: "Payment recorded." };
}

export async function createAdjustment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const dateStr = String(formData.get("date") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!dateStr) return { error: "Date is required." };
  if (!amountStr) return { error: "Amount is required." };
  if (!reason) return { error: "Reason is required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount)) return { error: "Amount must be a number." };

  const date = parseDateInput(dateStr);

  try {
    await prisma.contractorAdjustment.create({
      data: { date, amount, reason },
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "P2002") {
      return { error: "An adjustment with this date and reason already exists." };
    }
    throw err;
  }

  revalidatePath("/contractor");
  return { ok: "Adjustment recorded." };
}
