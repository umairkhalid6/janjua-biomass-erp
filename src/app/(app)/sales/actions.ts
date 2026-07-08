"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";
import { LOADING_CHARGE_PER_BAG } from "@/lib/constants";

export type ActionState = { error?: string; ok?: string };

// The form asks for the customer-facing price per bag (e.g. 2,500), which
// includes the fixed loading charge. Split it before saving so reports can
// track pellet revenue (2,490) and loading charges (10) separately, while
// invoices still bill the full entered price.
function splitRate(enteredRate: number) {
  return {
    ratePerBag: enteredRate - LOADING_CHARGE_PER_BAG,
    loadingChargePerBag: LOADING_CHARGE_PER_BAG,
  };
}

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
  const enteredRate = parseFloat(rateStr);

  if (isNaN(quantityBags) || quantityBags <= 0)
    return { error: "Quantity must be a positive number." };
  if (isNaN(enteredRate) || enteredRate <= LOADING_CHARGE_PER_BAG)
    return {
      error: `Rate must be above the Rs ${LOADING_CHARGE_PER_BAG}/bag loading charge.`,
    };

  const date = parseDateInput(dateStr);

  await prisma.pelletSale.create({
    data: {
      date,
      customerId,
      quantityBags,
      ...splitRate(enteredRate),
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
  // Operators may only ADD sales; editing an existing sale is admin-only.
  await requireAdmin();

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
  const enteredRate = parseFloat(rateStr);

  if (isNaN(quantityBags) || quantityBags <= 0)
    return { error: "Quantity must be a positive number." };
  if (isNaN(enteredRate) || enteredRate <= LOADING_CHARGE_PER_BAG)
    return {
      error: `Rate must be above the Rs ${LOADING_CHARGE_PER_BAG}/bag loading charge.`,
    };

  const date = parseDateInput(dateStr);

  // The sale may be edited from the customer ledger page; remember the
  // original customer so their ledger refreshes even if the sale moved.
  const previous = await prisma.pelletSale.findUnique({
    where: { id },
    select: { customerId: true },
  });

  await prisma.pelletSale.update({
    where: { id },
    data: {
      date,
      customerId,
      quantityBags,
      ...splitRate(enteredRate),
      notes: notes || null,
    },
  });

  revalidatePath("/sales");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  if (previous && previous.customerId !== customerId) {
    revalidatePath(`/customers/${previous.customerId}`);
  }
  return { ok: "Sale updated." };
}

export async function deleteSale(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.pelletSale.delete({ where: { id } });
  revalidatePath("/sales");
}
