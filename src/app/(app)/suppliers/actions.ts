"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string; id?: string };

// Opening balance is stored signed: positive = we owe the supplier (a payable
// carried from the old sheets), negative = an advance we already paid them.
// The form submits an unsigned amount plus an explicit direction so entering
// an advance can never be misread as a debt — the sign always comes from the
// selected direction, never from a typed minus.
function parseOpeningBalance(formData: FormData): number {
  const amountStr = String(formData.get("openingBalance") ?? "0").trim();
  const direction = String(formData.get("openingBalanceType") ?? "DR").trim();
  const amount = Math.abs(Number(amountStr) || 0);
  return direction === "CR" ? -amount : amount;
}

// Payment amount is entered unsigned with an explicit Credit/Debit direction.
// "Credit" is the normal payment/advance — it lands in the ledger's "Paid"
// column and reduces what we owe, so it is stored positive (the ledger negates
// it). "Debit" is an adjustment that increases what we owe, so it is stored
// negative. Returns null when the entered amount isn't a positive number.
function parseSignedPaymentAmount(formData: FormData): number | null {
  const amountStr = String(formData.get("amount") ?? "").trim();
  const direction = String(formData.get("direction") ?? "CR").trim();
  const amount = Math.abs(parseFloat(amountStr));
  if (isNaN(amount) || amount <= 0) return null;
  return direction === "DR" ? -amount : amount;
}

export async function createSupplier(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Supplier name is required." };

  const openingBalance = parseOpeningBalance(formData);

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

  if (!id) return { error: "Supplier ID missing." };
  if (!name) return { error: "Supplier name is required." };

  const openingBalance = parseOpeningBalance(formData);

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

  // Purchases and payments reference suppliers with ON DELETE RESTRICT, so the
  // owner would otherwise have to clear every entry by hand first. Instead,
  // remove the supplier together with all their ledger history in one
  // transaction. Payments are deleted before purchases so the payment→purchase
  // link (SET NULL) never briefly orphans a row mid-transaction.
  const [purchasesCount, paymentsCount] = await Promise.all([
    prisma.materialPurchase.count({ where: { supplierId: id } }),
    prisma.supplierPayment.count({ where: { supplierId: id } }),
  ]);

  await prisma.$transaction([
    prisma.supplierPayment.deleteMany({ where: { supplierId: id } }),
    prisma.materialPurchase.deleteMany({ where: { supplierId: id } }),
    prisma.supplier.delete({ where: { id } }),
  ]);

  revalidatePath("/suppliers");
  revalidatePath("/purchases");
  revalidatePath("/reports/suppliers");
  const removed =
    purchasesCount > 0 || paymentsCount > 0
      ? ` Removed ${purchasesCount} purchase(s) and ${paymentsCount} payment(s).`
      : "";
  return { ok: `Supplier deleted.${removed}` };
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

  if (!supplierId) return { error: "Supplier ID missing." };
  if (!dateStr) return { error: "Date is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseSignedPaymentAmount(formData);
  if (amount === null)
    return { error: "Amount must be a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.supplierPayment.create({
    data: {
      supplierId,
      date,
      amount,
      method: method || "Cash",
      notes: notes || null,
      // Always unlinked: payments settle the running balance FIFO-style, so
      // there is nothing to point at a specific purchase anymore. (Linked
      // rows still exist for pay-at-purchase entries, purely for display.)
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
