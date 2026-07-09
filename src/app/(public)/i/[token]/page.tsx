import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/format";
import { getInvoiceBalances } from "@/lib/invoice-balance";
import { InvoiceDocument } from "@/components/invoice-document";

// Public, no-auth invoice page reached via a tokenized WhatsApp link.
// Middleware lets /i/* through (see auth.config.ts). This looks up ONE sale by
// its unguessable share token and renders only that invoice — no other data.
export const dynamic = "force-dynamic";

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token) notFound();

  const sale = await prisma.pelletSale.findUnique({
    where: { shareToken: token },
    include: { customer: true },
  });
  if (!sale) notFound();

  const balances = await getInvoiceBalances(sale.id);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <InvoiceDocument
        invoiceLabel={`INV-${String(sale.invoiceNo).padStart(5, "0")}`}
        date={toDateInputValue(sale.date)}
        customer={{
          name: sale.customer.name,
          company: sale.customer.company,
          phone: sale.customer.phone,
        }}
        quantityBags={sale.quantityBags.toNumber()}
        // Customer-facing rate: pellet price + loading charge (internal split
        // not shown on the invoice).
        ratePerBag={
          sale.ratePerBag.toNumber() + sale.loadingChargePerBag.toNumber()
        }
        notes={sale.notes}
        previousBalance={balances.previousBalance}
        amountReceived={balances.amountReceived}
      />
    </div>
  );
}
