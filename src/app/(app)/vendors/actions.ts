"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

export type ActionState = { error?: string; ok?: string };

export async function createVendor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) return { error: "Vendor name is required." };

  await prisma.vendor.create({
    data: {
      name,
      phone: phone || null,
      notes: notes || null,
    },
  });

  revalidatePath("/vendors");
  revalidatePath("/purchases");
  return { ok: `Vendor "${name}" created.` };
}

export async function updateVendor(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id) return { error: "Vendor ID missing." };
  if (!name) return { error: "Vendor name is required." };

  await prisma.vendor.update({
    where: { id },
    data: {
      name,
      phone: phone || null,
      notes: notes || null,
    },
  });

  revalidatePath("/vendors");
  revalidatePath("/purchases");
  return { ok: "Vendor updated." };
}
