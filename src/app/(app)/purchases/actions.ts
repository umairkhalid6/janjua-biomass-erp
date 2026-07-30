"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";
import { EPSILON, round2 } from "@/lib/money";
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
  // the payable (material) portion alongside the purchase. Handling cost is
  // the owner's own expense — never owed to the supplier — so payments are
  // capped at material cost. The UNPAID branch may still carry an optional
  // partial amount paid now; the rest goes on the balance.
  const isPaid = paymentStatus === "PAID";
  const total = materialCost + handlingCost;
  const amountPaid = isPaid ? materialCost : parseFloat(amountPaidStr || "0");
  if (isNaN(amountPaid) || amountPaid < 0)
    return { error: "Amount paid must be zero or a positive number." };
  if (amountPaid > materialCost)
    return {
      error:
        "Amount paid cannot exceed the material cost — handling cost is your own expense, not payable to the supplier.",
    };

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
  const paymentStatus = String(formData.get("paymentStatus") ?? "").trim();
  const amountPaidStr = String(formData.get("amountPaid") ?? "").trim();
  const paymentMethod =
    String(formData.get("paymentMethod") ?? "").trim() || "Cash";

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

  const existing = await prisma.materialPurchase.findUnique({
    where: { id },
    select: {
      supplierId: true,
      payments: {
        select: { id: true, amount: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!existing) return { error: "Purchase not found." };

  // The payment recorded against this purchase is what the Payment Status
  // dropdown edits — same cap as on entry: only material cost is payable to
  // the supplier. An empty paymentStatus means the form didn't submit the
  // field, so payments are left alone.
  const editsPayment = paymentStatus === "PAID" || paymentStatus === "UNPAID";
  const targetPaid =
    paymentStatus === "PAID" ? materialCost : parseFloat(amountPaidStr || "0");
  if (editsPayment && (isNaN(targetPaid) || targetPaid < 0))
    return { error: "Amount paid must be zero or a positive number." };
  if (editsPayment && targetPaid > materialCost)
    return {
      error:
        "Amount paid cannot exceed the material cost — handling cost is your own expense, not payable to the supplier.",
    };

  await prisma.$transaction(async (tx) => {
    await tx.materialPurchase.update({
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

    // Payments logged against this purchase belong to whoever supplied it, so
    // move them when the supplier is reassigned — otherwise the old supplier
    // keeps the credit while the purchase lands on the new supplier's ledger.
    if (existing.supplierId !== supplierId) {
      await tx.supplierPayment.updateMany({
        where: { purchaseId: id },
        data: { supplierId },
      });
    }

    // Reconcile the linked payments to the status the owner picked: top up
    // with a new payment dated with the purchase (so the ledger still folds it
    // as "Paid at entry") when short, and trim the most recent linked payments
    // when over. The Payment badge itself stays FIFO-derived across the whole
    // account (v_purchase_settlement), so a lump-sum payment can still show
    // this purchase as paid even with nothing linked to it.
    if (!editsPayment) return;
    const linkedTotal = existing.payments.reduce(
      (sum, p) => sum + p.amount.toNumber(),
      0
    );
    const diff = round2(targetPaid - linkedTotal);
    if (diff > EPSILON) {
      await tx.supplierPayment.create({
        data: {
          supplierId,
          purchaseId: id,
          date,
          amount: diff,
          method: paymentMethod,
        },
      });
    } else if (diff < -EPSILON) {
      let excess = -diff;
      for (const p of [...existing.payments].reverse()) {
        if (excess <= EPSILON) break;
        const amount = p.amount.toNumber();
        // Debit adjustments (negative rows) are deliberate ledger entries and
        // removing one would *raise* the paid total — trim actual payments
        // only. Their positive counterparts always cover the excess.
        if (amount <= 0) continue;
        if (amount <= excess + EPSILON) {
          await tx.supplierPayment.delete({ where: { id: p.id } });
          excess = round2(excess - amount);
        } else {
          await tx.supplierPayment.update({
            where: { id: p.id },
            data: { amount: round2(amount - excess) },
          });
          excess = 0;
        }
      }
    }
  });

  revalidatePath("/purchases");
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  if (existing.supplierId !== supplierId)
    revalidatePath(`/suppliers/${existing.supplierId}`);
  revalidatePath("/reports/suppliers");

  return { ok: "Purchase updated." };
}

export async function deletePurchase(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const purchase = await prisma.materialPurchase.findUnique({
    where: { id },
    select: { supplierId: true },
  });
  if (!purchase) return;
  await prisma.materialPurchase.delete({ where: { id } });
  // Removing a purchase re-ranks FIFO settlement for the supplier's other
  // purchases, so their pages must refresh too.
  revalidatePath("/purchases");
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${purchase.supplierId}`);
  revalidatePath("/reports/suppliers");
}
