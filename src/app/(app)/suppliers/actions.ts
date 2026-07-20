"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string; id?: string };

export async function createSupplier(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const openingBalanceStr = String(formData.get("openingBalance") ?? "0").trim();

  if (!name) return { error: "Supplier name is required." };

  const openingBalance = Number(openingBalanceStr) || 0;

  const created = await prisma.supplier.create({
    data: {
      name,
      phone: phone || null,
      notes: notes || null,
      openingBalance,
    },
  });

  revalidatePath("/suppliers");
  revalidatePath("/purchases");
  return { ok: `Supplier "${name}" created.`, id: created.id };
}

export async function updateSupplier(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const openingBalanceStr = String(formData.get("openingBalance") ?? "0").trim();

  if (!id) return { error: "Supplier ID missing." };
  if (!name) return { error: "Supplier name is required." };

  const openingBalance = Number(openingBalanceStr) || 0;

  await prisma.supplier.update({
    where: { id },
    data: {
      name,
      phone: phone || null,
      notes: notes || null,
      openingBalance,
    },
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  revalidatePath("/purchases");
  return { ok: "Supplier updated." };
}

export async function deleteSupplier(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Supplier ID missing." };

  // Purchases and payments reference suppliers with ON DELETE RESTRICT, so a
  // supplier with ledger history cannot be removed — the records would be
  // orphaned. Check up front to give a clear message instead of a DB error.
  const [purchasesCount, paymentsCount] = await Promise.all([
    prisma.materialPurchase.count({ where: { supplierId: id } }),
    prisma.supplierPayment.count({ where: { supplierId: id } }),
  ]);
  if (purchasesCount > 0 || paymentsCount > 0) {
    return {
      error: `This supplier has ${purchasesCount} purchase(s) and ${paymentsCount} payment(s) on record and cannot be deleted. Delete those entries first.`,
    };
  }

  await prisma.supplier.delete({ where: { id } });

  revalidatePath("/suppliers");
  revalidatePath("/purchases");
  revalidatePath("/reports/suppliers");
  return { ok: "Supplier deleted." };
}

export async function createSupplierPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const method = String(formData.get("method") ?? "Cash").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const purchaseId = String(formData.get("purchaseId") ?? "").trim();

  if (!supplierId) return { error: "Supplier ID missing." };
  if (!dateStr) return { error: "Date is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.supplierPayment.create({
    data: {
      supplierId,
      date,
      amount,
      method: method || "Cash",
      notes: notes || null,
      // Empty string means "general payment" — leave unlinked so it applies
      // to the running balance rather than one specific purchase.
      purchaseId: purchaseId || null,
    },
  });

  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  revalidatePath("/reports/suppliers");
  // Payments drive the Paid/Partial/Unpaid badge on the purchases list.
  revalidatePath("/purchases");
  return { ok: "Payment recorded." };
}

export async function deleteSupplierPayment(
  formData: FormData
): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();

  if (!id) return;

  await prisma.supplierPayment.delete({ where: { id } });

  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  revalidatePath("/reports/suppliers");
  revalidatePath("/purchases");
}
