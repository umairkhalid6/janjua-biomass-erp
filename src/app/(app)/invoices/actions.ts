"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";
import type { CustomInvoiceLine } from "@/lib/custom-invoice";

// Standalone invoices: saved on their own, never touch sales, customers,
// stock or any ledger.

export type ActionState = { error?: string; ok?: string };

type Parsed =
  | { error: string }
  | {
      data: {
        date: Date;
        customerName: string;
        customerAddress: string | null;
        customerPhone: string | null;
        notes: string | null;
      };
      items: CustomInvoiceLine[];
    };

function optional(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? "").trim();
  return v || null;
}

// Line items arrive as parallel repeated fields (one set per row).
function parseInvoiceForm(formData: FormData): Parsed {
  const dateStr = String(formData.get("date") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  if (!dateStr) return { error: "Date is required." };
  if (!customerName) return { error: "Customer name is required." };

  const descriptions = formData.getAll("description").map((v) => String(v).trim());
  const bags = formData.getAll("quantityBags").map((v) => String(v).trim());
  const sizes = formData.getAll("bagSizeKg").map((v) => String(v).trim());
  const rates = formData.getAll("ratePerKg").map((v) => String(v).trim());

  const items: CustomInvoiceLine[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const row = i + 1;
    // Skip rows left completely empty.
    if (!descriptions[i] && !bags[i] && !rates[i]) continue;
    const quantityBags = parseFloat(bags[i]);
    const bagSizeKg = parseFloat(sizes[i]);
    const ratePerKg = parseFloat(rates[i]);
    if (!descriptions[i]) return { error: `Item ${row}: description is required.` };
    if (isNaN(quantityBags) || quantityBags <= 0)
      return { error: `Item ${row}: quantity must be a positive number.` };
    if (isNaN(bagSizeKg) || bagSizeKg <= 0)
      return { error: `Item ${row}: bag size must be a positive number.` };
    if (isNaN(ratePerKg) || ratePerKg < 0)
      return { error: `Item ${row}: rate per kg must be zero or more.` };
    items.push({ description: descriptions[i], quantityBags, bagSizeKg, ratePerKg });
  }
  if (items.length === 0) return { error: "Add at least one item." };

  return {
    data: {
      date: parseDateInput(dateStr),
      customerName,
      customerAddress: optional(formData, "customerAddress"),
      customerPhone: optional(formData, "customerPhone"),
      notes: optional(formData, "notes"),
    },
    items,
  };
}

const toRows = (items: CustomInvoiceLine[]) =>
  items.map((it, i) => ({ ...it, sortOrder: i }));

export async function createCustomInvoice(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseInvoiceForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const invoice = await prisma.customInvoice.create({
    data: { ...parsed.data, items: { create: toRows(parsed.items) } },
    select: { id: true },
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function updateCustomInvoice(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Invoice ID missing." };
  const parsed = parseInvoiceForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  // Replace the item set wholesale — simplest correct way to handle rows that
  // were added, removed or reordered in the form.
  await prisma.$transaction([
    prisma.customInvoiceItem.deleteMany({ where: { invoiceId: id } }),
    prisma.customInvoice.update({
      where: { id },
      data: { ...parsed.data, items: { create: toRows(parsed.items) } },
    }),
  ]);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return { ok: "Invoice updated." };
}

export async function deleteCustomInvoice(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.customInvoice.delete({ where: { id } });
  revalidatePath("/invoices");
}
