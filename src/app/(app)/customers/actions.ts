"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

export type ActionState = { error?: string; ok?: string };

export async function createCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name) return { error: "Customer name is required." };

  await prisma.customer.create({
    data: {
      name,
      company: company || null,
      phone: phone || null,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/sales");
  return { ok: `Customer "${name}" created.` };
}

export async function updateCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!id) return { error: "Customer ID missing." };
  if (!name) return { error: "Customer name is required." };

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      company: company || null,
      phone: phone || null,
    },
  });

  revalidatePath("/customers");
  revalidatePath("/sales");
  return { ok: "Customer updated." };
}
