"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string; id?: string };

export async function createCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const openingBalanceStr = String(formData.get("openingBalance") ?? "0").trim();

  if (!name) return { error: "Customer name is required." };

  const openingBalance = Number(openingBalanceStr) || 0;

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
  const openingBalanceStr = String(formData.get("openingBalance") ?? "0").trim();

  if (!id) return { error: "Customer ID missing." };
  if (!name) return { error: "Customer name is required." };

  const openingBalance = Number(openingBalanceStr) || 0;

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
