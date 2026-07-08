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
    return { error: "Handling cost must be a non-negative number." };

  const date = parseDateInput(dateStr);
  const ratePerKg = (materialCost + handlingCost) / weightKg;

  await prisma.materialPurchase.create({
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
  return { ok: "Purchase recorded." };
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
