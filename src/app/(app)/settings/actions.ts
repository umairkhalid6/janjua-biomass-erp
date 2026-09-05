"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";

export type ActionState = { error?: string; ok?: string };

/** Today as UTC midnight, matching how parseDateInput stores @db.Date fields. */
function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export async function createContractorRate(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const dateStr = String(formData.get("effectiveFrom") ?? "").trim();
  const dayStr = String(formData.get("dayRatePerKg") ?? "").trim();
  const nightStr = String(formData.get("nightRatePerKg") ?? "").trim();

  if (!dateStr) return { error: "Effective-from date is required." };
  if (!dayStr) return { error: "Day shift rate is required." };
  if (!nightStr) return { error: "Night shift rate is required." };

  const dayRatePerKg = parseFloat(dayStr);
  if (isNaN(dayRatePerKg) || dayRatePerKg <= 0)
    return { error: "Day shift rate must be a positive number." };

  const nightRatePerKg = parseFloat(nightStr);
  if (isNaN(nightRatePerKg) || nightRatePerKg <= 0)
    return { error: "Night shift rate must be a positive number." };

  const effectiveFrom = parseDateInput(dateStr);

  // A rate change costs production from its effective date onward and must
  // never re-price what the contractor was already paid for, so back-dating is
  // refused here. Historical corrections are a migration, not a settings edit.
  if (effectiveFrom.getTime() < todayUtc().getTime())
    return {
      error:
        "Rate changes apply to future production only — pick today or a later date.",
    };

  try {
    await prisma.contractorRate.create({
      data: { effectiveFrom, dayRatePerKg, nightRatePerKg },
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
