"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export type ActionState = { error?: string; ok?: string };

function normRole(v: FormDataEntryValue | null): Role {
  return v === "ADMIN" ? "ADMIN" : "OPERATOR";
}

export async function createUser(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const role = normRole(formData.get("role"));

  if (!name || !email || password.length < 6) {
    return { error: "Name, email and a password (6+ chars) are required." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10), role },
  });

  revalidatePath("/users");
  return { ok: `Created ${email}.` };
}

export async function toggleActive(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return;

  // An admin cannot deactivate their own account.
  if (user.id === admin.id && user.active) return;

  await prisma.user.update({
    where: { id },
    data: { active: !user.active },
  });
  revalidatePath("/users");
}

export async function resetPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    return { error: "New password must be at least 6 characters." };
  }
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/users");
  return { ok: "Password updated." };
}
