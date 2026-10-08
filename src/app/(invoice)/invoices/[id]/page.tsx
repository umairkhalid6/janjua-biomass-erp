import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatPKR, toDateInputValue } from "@/lib/format";
import { customInvoiceLabel, invoiceTotals } from "@/lib/custom-invoice";
import { CustomInvoiceDocument } from "@/components/custom-invoice-document";
import { ShareWhatsappButton } from "@/components/share-whatsapp-button";
import { DownloadPdfButton } from "@/components/download-pdf-button";

// Chrome-free view of a standalone invoice (lives in the (invoice) route group
// so the app shell/nav isn't rendered or captured).
export default async function CustomInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const invoice = await prisma.customInvoice.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!invoice) notFound();

  const items = invoice.items.map((it) => ({
    description: it.description,
    quantityBags: it.quantityBags.toNumber(),
    bagSizeKg: it.bagSizeKg.toNumber(),
    ratePerKg: it.ratePerKg.toNumber(),
  }));
  const label = customInvoiceLabel(invoice.invoiceNo);
  const total = formatPKR(invoiceTotals(items).amount);
  const caption = [
    `Assalam-o-Alaikum ${invoice.customerName},`,
    ``,
    `Please find your invoice ${label} from Janjua Biomass Pellets.`,
    `Total amount: ${total}`,
    ``,
    `JazakAllah for your business.`,
  ].join("\n");

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="print:hidden sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/invoices"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to Invoices
          </Link>
          <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:items-center">
            <DownloadPdfButton
              targetId="invoice-capture"
              fileBaseName={`invoice-${label}`}
            />
            <ShareWhatsappButton
              targetId="invoice-capture"
              fileBaseName={`invoice-${label}`}
              customerName={invoice.customerName}
              invoiceLabel={label}
              caption={caption}
            />
          </div>
        </div>
      </div>

      <CustomInvoiceDocument
        id="invoice-capture"
        invoiceLabel={label}
        date={toDateInputValue(invoice.date)}
        customer={{
          name: invoice.customerName,
          address: invoice.customerAddress,
          phone: invoice.customerPhone,
        }}
        items={items}
        notes={invoice.notes}
      />
    </div>
  );
}
