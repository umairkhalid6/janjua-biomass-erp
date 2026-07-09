"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { parseDateInput } from "@/lib/format";
import { LOADING_CHARGE_PER_BAG } from "@/lib/constants";

export type ActionState = { error?: string; ok?: string };

// The form asks for the customer-facing price per bag (e.g. 2,500), which
// includes the fixed loading charge. Split it before saving so reports can
// track pellet revenue (2,490) and loading charges (10) separately, while
// invoices still bill the full entered price.
function splitRate(enteredRate: number) {
  return {
    ratePerBag: enteredRate - LOADING_CHARGE_PER_BAG,
    loadingChargePerBag: LOADING_CHARGE_PER_BAG,
  };
}

export async function createSale(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const dateStr = String(formData.get("date") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const quantityStr = String(formData.get("quantityBags") ?? "").trim();
  const rateStr = String(formData.get("ratePerBag") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const receivedStr = String(formData.get("amountReceived") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "Cash").trim();

  if (!dateStr) return { error: "Date is required." };
  if (!customerId) return { error: "Customer is required." };
  if (!quantityStr || !rateStr) return { error: "Quantity and rate are required." };

  const quantityBags = parseFloat(quantityStr);
  const enteredRate = parseFloat(rateStr);

  if (isNaN(quantityBags) || quantityBags <= 0)
    return { error: "Quantity must be a positive number." };
  if (isNaN(enteredRate) || enteredRate <= LOADING_CHARGE_PER_BAG)
    return {
      error: `Rate must be above the Rs ${LOADING_CHARGE_PER_BAG}/bag loading charge.`,
    };

  // Optional payment taken at the counter alongside the sale. It may exceed
  // the bill (the customer can clear previous dues in the same handover).
  const amountReceived = receivedStr ? parseFloat(receivedStr) : 0;
  if (isNaN(amountReceived) || amountReceived < 0)
    return { error: "Amount received must be zero or a positive number." };

  const date = parseDateInput(dateStr);

  await prisma.$transaction(async (tx) => {
    const sale = await tx.pelletSale.create({
      data: {
        date,
        customerId,
        quantityBags,
        ...splitRate(enteredRate),
        notes: notes || null,
        createdById: user.id,
      },
    });
    if (amountReceived > 0) {
      await tx.customerPayment.create({
        data: {
          customerId,
          saleId: sale.id,
          date,
          amount: amountReceived,
          method: paymentMethod || "Cash",
        },
      });
    }
  });

  revalidatePath("/sales");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/reports/customers");
  return {
    ok:
      amountReceived > 0
        ? "Sale and payment recorded."
        : "Sale recorded.",
  };
}

export async function updateSale(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Admins may edit any sale; operators may edit only the sales they created.
  const user = await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const quantityStr = String(formData.get("quantityBags") ?? "").trim();
  const rateStr = String(formData.get("ratePerBag") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id) return { error: "Sale ID missing." };
  if (!dateStr) return { error: "Date is required." };
  if (!customerId) return { error: "Customer is required." };
  if (!quantityStr || !rateStr) return { error: "Quantity and rate are required." };

  const quantityBags = parseFloat(quantityStr);
  const enteredRate = parseFloat(rateStr);

  if (isNaN(quantityBags) || quantityBags <= 0)
    return { error: "Quantity must be a positive number." };
  if (isNaN(enteredRate) || enteredRate <= LOADING_CHARGE_PER_BAG)
    return {
      error: `Rate must be above the Rs ${LOADING_CHARGE_PER_BAG}/bag loading charge.`,
    };

  const date = parseDateInput(dateStr);

  // The sale may be edited from the customer ledger page; remember the
  // original customer so their ledger refreshes even if the sale moved.
  const previous = await prisma.pelletSale.findUnique({
    where: { id },
    select: { customerId: true, createdById: true },
  });
  if (!previous) return { error: "Sale not found." };
  // Ownership guard: an operator can only edit sales they entered themselves.
  if (user.role !== "ADMIN" && previous.createdById !== user.id) {
    return { error: "You can only edit sales you created." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.pelletSale.update({
      where: { id },
      data: {
        date,
        customerId,
        quantityBags,
        ...splitRate(enteredRate),
        notes: notes || null,
      },
    });
    // Payments received against this invoice belong to whoever the invoice
    // bills — if the sale moved to another customer, move them with it.
    if (previous && previous.customerId !== customerId) {
      await tx.customerPayment.updateMany({
        where: { saleId: id },
        data: { customerId },
      });
    }
  });

  revalidatePath("/sales");
  revalidatePath(`/sales/${id}/invoice`);
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  if (previous && previous.customerId !== customerId) {
    revalidatePath(`/customers/${previous.customerId}`);
  }
  return { ok: "Sale updated." };
}

export async function deleteSale(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Linked payments survive (saleId is SET NULL on delete) — the money was
  // still received; only the invoice reference goes away.
  const sale = await prisma.pelletSale.findUnique({
    where: { id },
    select: { customerId: true },
  });
  await prisma.pelletSale.delete({ where: { id } });
  revalidatePath("/sales");
  revalidatePath("/customers");
  if (sale) revalidatePath(`/customers/${sale.customerId}`);
  revalidatePath("/reports/customers");
}

// ——— Invoice-page payments ———————————————————————————————————————————
// Recorded from the invoice screen right before printing/sharing, so the
// generated image can show "Amount Received" and the true balance due.

export async function recordInvoicePayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const saleId = String(formData.get("saleId") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const method = String(formData.get("method") ?? "Cash").trim();

  if (!saleId) return { error: "Invoice reference missing." };
  if (!dateStr) return { error: "Date is required." };

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0)
    return { error: "Amount must be a positive number." };

  const sale = await prisma.pelletSale.findUnique({
    where: { id: saleId },
    select: { customerId: true },
  });
  if (!sale) return { error: "Invoice not found." };

  await prisma.customerPayment.create({
    data: {
      customerId: sale.customerId,
      saleId,
      date: parseDateInput(dateStr),
      amount,
      method: method || "Cash",
    },
  });

  revalidatePath(`/sales/${saleId}/invoice`);
  revalidatePath("/sales");
  revalidatePath("/customers");
  revalidatePath(`/customers/${sale.customerId}`);
  revalidatePath("/reports/customers");
  return { ok: "Payment recorded." };
}

export async function deleteInvoicePayment(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const saleId = String(formData.get("saleId") ?? "").trim();
  if (!id) return;
  const payment = await prisma.customerPayment.findUnique({
    where: { id },
    select: { customerId: true },
  });
  if (!payment) return;
  await prisma.customerPayment.delete({ where: { id } });
  if (saleId) revalidatePath(`/sales/${saleId}/invoice`);
  revalidatePath("/sales");
  revalidatePath("/customers");
  revalidatePath(`/customers/${payment.customerId}`);
  revalidatePath("/reports/customers");
}
