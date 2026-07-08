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

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
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

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
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
