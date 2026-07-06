import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { formatPKR, toDateInputValue } from "@/lib/format";
import { InvoiceDocument } from "@/components/invoice-document";
import { ShareWhatsappButton } from "@/components/share-whatsapp-button";
import { PrintButton } from "./print-button";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const sale = await prisma.pelletSale.findUnique({
    where: { id },
    include: { customer: true },
  });

  if (!sale) notFound();

  const quantityBags = sale.quantityBags.toNumber();
  const ratePerBag = sale.ratePerBag.toNumber();
  const amount = quantityBags * ratePerBag;
  const invoiceLabel = `INV-${String(sale.invoiceNo).padStart(5, "0")}`;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Screen-only controls */}
      <div className="print:hidden flex flex-wrap items-center gap-4 border-b border-neutral-200 px-6 py-3 bg-neutral-50">
        <Link
          href="/sales"
          className="text-sm text-neutral-600 underline hover:text-neutral-900"
        >
          ← Back to Sales
        </Link>
        <PrintButton />
        <ShareWhatsappButton
          targetId="invoice-capture"
          fileBaseName={`invoice-${invoiceLabel}`}
          customerName={sale.customer.name}
          invoiceLabel={invoiceLabel}
          amount={formatPKR(amount)}
        />
      </div>

      <InvoiceDocument
        id="invoice-capture"
        invoiceLabel={invoiceLabel}
        date={toDateInputValue(sale.date)}
        customer={{
          name: sale.customer.name,
          company: sale.customer.company,
          phone: sale.customer.phone,
        }}
        quantityBags={quantityBags}
        ratePerBag={ratePerBag}
        notes={sale.notes}
      />
    </div>
  );
}
