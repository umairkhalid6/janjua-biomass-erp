"use server";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

/**
 * Return the sale's public share token, generating (and persisting) one on the
 * first share. The token is the only credential on the public /i/[token] page,
 * so it must be unguessable.
 */
export async function getOrCreateShareToken(
  saleId: string
): Promise<{ token?: string; error?: string }> {
  await requireAdmin();

  const sale = await prisma.pelletSale.findUnique({
    where: { id: saleId },
    select: { id: true, shareToken: true },
  });
  if (!sale) return { error: "Invoice not found." };
  if (sale.shareToken) return { token: sale.shareToken };

  const token = randomUUID().replace(/-/g, "");
  await prisma.pelletSale.update({
    where: { id: saleId },
    data: { shareToken: token },
  });
  return { token };
}
