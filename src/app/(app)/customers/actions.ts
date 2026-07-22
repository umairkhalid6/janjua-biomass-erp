"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string; id?: string };

// Opening balance is stored signed: positive = customer owes us (Dr),
// negative = advance/credit on account (Cr). The form submits an unsigned
// amount plus an explicit direction so a typed "-50000" can never be
// misread — the sign always comes from the selected direction.
function parseOpeningBalance(formData: FormData): number {
  const amountStr = String(formData.get("openingBalance") ?? "0").trim();
  const direction = String(formData.get("openingBalanceType") ?? "DR").trim();
  const amount = Math.abs(Number(amountStr) || 0);
  return direction === "CR" ? -amount : amount;
}

// Payment amount is entered unsigned with an explicit Credit/Debit direction
// (mirrors parseOpeningBalance). "Credit" is the normal receipt/advance — it
// lands in the ledger's "Received" column and reduces the balance, so it is
// stored positive (the ledger negates it). "Debit" is a charge/adjustment —
// it lands in the "Billed" column and increases the balance, so it is stored
// negative. Returns null when the entered amount isn't a positive number.
function parseSignedPaymentAmount(formData: FormData): number | null {
  const amountStr = String(formData.get("amount") ?? "").trim();
  const direction = String(formData.get("direction") ?? "CR").trim();
  const amount = Math.abs(parseFloat(amountStr));
  if (isNaN(amount) || amount <= 0) return null;
  return direction === "DR" ? -amount : amount;
}

export async function createCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { error: "Customer name is required." };

  const openingBalance = parseOpeningBalance(formData);

  const created = await prisma.customer.create({
    data: {
      name,
      company: company || null,
      phone: phone || null,
      openingBalance,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/sales");
  return { ok: `Customer "${name}" created.`, id: created.id };
}

export async function updateCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!id) return { error: "Customer ID missing." };
  if (!name) return { error: "Customer name is required." };

  const openingBalance = parseOpeningBalance(formData);

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      company: company || null,
      phone: phone || null,
      openingBalance,
    },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/sales");
  return { ok: "Customer updated." };
}

export async function deleteCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Customer ID missing." };

  // Sales and payments reference customers with ON DELETE RESTRICT, so the
  // owner would otherwise have to clear every entry by hand first. Instead,
  // remove the customer together with all their ledger history in one
  // transaction. Payments are deleted before sales so the payment→sale link
  // (SET NULL) never briefly orphans a row mid-transaction.
  const [salesCount, paymentsCount] = await Promise.all([
    prisma.pelletSale.count({ where: { customerId: id } }),
    prisma.customerPayment.count({ where: { customerId: id } }),
  ]);

  await prisma.$transaction([
    prisma.customerPayment.deleteMany({ where: { customerId: id } }),
    prisma.pelletSale.deleteMany({ where: { customerId: id } }),
    prisma.customer.delete({ where: { id } }),
  ]);

  revalidatePath("/customers");
  revalidatePath("/sales");
  revalidatePath("/reports/customers");
  const removed =
    salesCount > 0 || paymentsCount > 0
      ? ` Removed ${salesCount} sale(s) and ${paymentsCount} payment(s).`
      : "";
  return { ok: `Customer deleted.${removed}` };
}

export async function createCustomerPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const customerId = String(formData.get("customerId") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const method = String(formData.get("method") ?? "Cash").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!customerId) return { error: "Customer ID missing." };
  if (!dateStr) return { error: "Date is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseSignedPaymentAmount(formData);
  if (amount === null)
    return { error: "Amount must be a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.customerPayment.create({
    data: {
      customerId,
      date,
      amount,
      method: method || "Cash",
      notes: notes || null,
    },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/reports/customers");
  return { ok: "Payment recorded." };
}

export async function updateCustomerPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const method = String(formData.get("method") ?? "Cash").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id) return { error: "Payment ID missing." };
  if (!dateStr) return { error: "Date is required." };
  if (!amountStr) return { error: "Amount is required." };

  const amount = parseSignedPaymentAmount(formData);
  if (amount === null)
    return { error: "Amount must be a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.customerPayment.update({
    where: { id },
    data: {
      date,
      amount,
      method: method || "Cash",
      notes: notes || null,
    },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/reports/customers");
  return { ok: "Payment updated." };
}

export async function deleteCustomerPayment(
  formData: FormData
): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();

  if (!id) return;

  await prisma.customerPayment.delete({ where: { id } });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/reports/customers");
}
