"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string };

export async function createContractorRate(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const dateStr = String(formData.get("effectiveFrom") ?? "").trim();
  const rateStr = String(formData.get("ratePerKg") ?? "").trim();

  if (!dateStr) return { error: "Effective-from date is required." };
  if (!rateStr) return { error: "Rate per kg is required." };

  const ratePerKg = parseFloat(rateStr);
  if (isNaN(ratePerKg) || ratePerKg <= 0)
    return { error: "Rate must be a positive number." };

  const effectiveFrom = parseDateInput(dateStr);

  try {
    await prisma.contractorRate.create({
      data: { effectiveFrom, ratePerKg },
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "P2002") {
      return { error: "A rate with this effective-from date already exists." };
    }
    throw err;
  }

  revalidatePath("/settings");
  return { ok: "Rate added." };
}
