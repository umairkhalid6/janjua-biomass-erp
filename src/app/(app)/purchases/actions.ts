"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";
import type { MaterialType } from "@prisma/client";

export type ActionState = { error?: string; ok?: string };

function parseMaterial(v: FormDataEntryValue | null): MaterialType {
  const valid: MaterialType[] = [
    "POPLAR",
    "HARDWOOD",
    "HAIDERI_PLYWOOD",
    "WOOD_CHIPS",
  ];
  const s = String(v ?? "");
  return valid.includes(s as MaterialType) ? (s as MaterialType) : "POPLAR";
}

export async function createPurchase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const dateStr = String(formData.get("date") ?? "").trim();
  const materialType = parseMaterial(formData.get("materialType"));
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const weightStr = String(formData.get("weightKg") ?? "").trim();
  const materialCostStr = String(formData.get("materialCost") ?? "").trim();
  const handlingCostStr = String(formData.get("handlingCost") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const paymentStatus = String(formData.get("paymentStatus") ?? "PAID").trim();
  const amountPaidStr = String(formData.get("amountPaid") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "Cash").trim();

  if (!dateStr) return { error: "Date is required." };
  if (!supplierId) return { error: "Supplier is required." };
  if (!weightStr || !materialCostStr)
    return { error: "Weight and material cost are required." };

  const weightKg = parseFloat(weightStr);
  const materialCost = parseFloat(materialCostStr);
  const handlingCost = parseFloat(handlingCostStr || "0");

  if (isNaN(weightKg) || weightKg <= 0)
    return { error: "Weight must be a positive number." };
  if (isNaN(materialCost) || materialCost < 0)
    return { error: "Material cost must be a non-negative number." };
  if (isNaN(handlingCost) || handlingCost < 0)
    return { error: "Handling cost must be non-negative number." };

  // Paid in full is the default (the common case at the counter) and settles
  // the whole order alongside the purchase. The UNPAID branch may still carry
  // an optional partial amount paid now; the rest goes on the balance.
  const isPaid = paymentStatus === "PAID";
  const total = materialCost + handlingCost;
  const amountPaid = isPaid ? total : parseFloat(amountPaidStr || "0");
  if (isNaN(amountPaid) || amountPaid < 0)
    return { error: "Amount paid must be zero or a positive number." };
  if (amountPaid > total)
    return { error: "Amount paid cannot exceed the order total." };

  const date = parseDateInput(dateStr);
  const ratePerKg = total / weightKg;

  await prisma.$transaction(async (tx) => {
    const purchase = await tx.materialPurchase.create({
      data: {
        date,
        materialType,
        supplierId,
        weightKg,
        materialCost,
        handlingCost,
        ratePerKg,
        notes: notes || null,
      },
    });
    if (amountPaid > 0) {
      await tx.supplierPayment.create({
        data: {
          supplierId,
          purchaseId: purchase.id,
          date,
          amount: amountPaid,
          method: paymentMethod || "Cash",
        },
      });
    }
  });

  revalidatePath("/purchases");
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/reports/suppliers");
  return {
    ok: amountPaid > 0 ? "Purchase and payment recorded." : "Purchase recorded.",
  };
}

export async function updatePurchase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const materialType = parseMaterial(formData.get("materialType"));
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const weightStr = String(formData.get("weightKg") ?? "").trim();
  const materialCostStr = String(formData.get("materialCost") ?? "").trim();
  const handlingCostStr = String(formData.get("handlingCost") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id) return { error: "Purchase ID missing." };
  if (!dateStr) return { error: "Date is required." };
  if (!supplierId) return { error: "Supplier is required." };
  if (!weightStr || !materialCostStr)
    return { error: "Weight and material cost are required." };

  const weightKg = parseFloat(weightStr);
  const materialCost = parseFloat(materialCostStr);
  const handlingCost = parseFloat(handlingCostStr || "0");

  if (isNaN(weightKg) || weightKg <= 0)
    return { error: "Weight must be a positive number." };
  if (isNaN(materialCost) || materialCost < 0)
    return { error: "Material cost must be non-negative." };
  if (isNaN(handlingCost) || handlingCost < 0)
    return { error: "Handling cost must be non-negative." };

  const date = parseDateInput(dateStr);
  const ratePerKg = (materialCost + handlingCost) / weightKg;

  await prisma.materialPurchase.update({
    where: { id },
    data: {
      date,
      materialType,
      supplierId,
      weightKg,
      materialCost,
      handlingCost,
      ratePerKg,
      notes: notes || null,
    },
  });

  revalidatePath("/purchases");
  return { ok: "Purchase updated." };
}

export async function deletePurchase(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.materialPurchase.delete({ where: { id } });
  revalidatePath("/purchases");
}
