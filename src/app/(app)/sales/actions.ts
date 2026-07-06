"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string };

export async function createSale(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const dateStr = String(formData.get("date") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const quantityStr = String(formData.get("quantityBags") ?? "").trim();
  const rateStr = String(formData.get("ratePerBag") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!dateStr) return { error: "Date is required." };
  if (!customerId) return { error: "Customer is required." };
  if (!quantityStr || !rateStr) return { error: "Quantity and rate are required." };

  const quantityBags = parseFloat(quantityStr);
  const ratePerBag = parseFloat(rateStr);

  if (isNaN(quantityBags) || quantityBags <= 0)
    return { error: "Quantity must be a positive number." };
  if (isNaN(ratePerBag) || ratePerBag <= 0)
    return { error: "Rate must be a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.pelletSale.create({
    data: {
      date,
      customerId,
      quantityBags,
      ratePerBag,
      notes: notes || null,
      createdById: user.id,
    },
  });

  revalidatePath("/sales");
  return { ok: "Sale recorded." };
}

export async function updateSale(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const quantityStr = String(formData.get("quantityBags") ?? "").trim();
  const rateStr = String(formData.get("ratePerBag") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id) return { error: "Sale ID missing." };
  if (!dateStr) return { error: "Date is required." };
  if (!customerId) return { error: "Customer is required." };
  if (!quantityStr || !rateStr) return { error: "Quantity and rate are required." };

  const quantityBags = parseFloat(quantityStr);
  const ratePerBag = parseFloat(rateStr);

  if (isNaN(quantityBags) || quantityBags <= 0)
    return { error: "Quantity must be a positive number." };
  if (isNaN(ratePerBag) || ratePerBag <= 0)
    return { error: "Rate must be a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.pelletSale.update({
    where: { id },
    data: {
      date,
      customerId,
      quantityBags,
      ratePerBag,
      notes: notes || null,
    },
  });

  revalidatePath("/sales");
  return { ok: "Sale updated." };
}

export async function deleteSale(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.pelletSale.delete({ where: { id } });
  revalidatePath("/sales");
}
