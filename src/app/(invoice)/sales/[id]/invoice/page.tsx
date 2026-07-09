import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatPKR, toDateInputValue } from "@/lib/format";
import { getInvoiceBalances } from "@/lib/invoice-balance";
import { InvoiceDocument } from "@/components/invoice-document";
import { ShareWhatsappButton } from "@/components/share-whatsapp-button";
import { PrintButton } from "./print-button";
import { RecordPaymentPanel } from "./record-payment";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const sale = await prisma.pelletSale.findUnique({
    where: { id },
    include: {
      customer: true,
      payments: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!sale) notFound();

  const balances = await getInvoiceBalances(sale.id);
  const { previousBalance, totalPayable, amountReceived, balanceDue } = balances;

  const quantityBags = sale.quantityBags.toNumber();
  // The invoice bills the customer-facing rate: pellet price + loading charge
  // (the split is an internal bookkeeping detail, not shown to the customer).
  const ratePerBag =
    sale.ratePerBag.toNumber() + sale.loadingChargePerBag.toNumber();
  const amount = quantityBags * ratePerBag;
  const invoiceLabel = `INV-${String(sale.invoiceNo).padStart(5, "0")}`;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Screen-only controls */}
      <div className="print:hidden sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/sales"
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
            Back to Sales
          </Link>
          <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:items-center">
            <PrintButton />
            <ShareWhatsappButton
              targetId="invoice-capture"
              fileBaseName={`invoice-${invoiceLabel}`}
              customerName={sale.customer.name}
              invoiceLabel={invoiceLabel}
              amounts={{
                invoiceAmount: formatPKR(amount),
                previousBalance:
                  previousBalance > 0 ? formatPKR(previousBalance) : null,
                totalPayable:
                  previousBalance > 0 ? formatPKR(totalPayable) : null,
                amountReceived:
                  amountReceived > 0 ? formatPKR(amountReceived) : null,
                balanceDue: formatPKR(Math.max(balanceDue, 0)),
              }}
            />
          </div>
        </div>
      </div>

      {/* Screen-only: record money received against this invoice so the
          shared/printed document reflects it. */}
      <RecordPaymentPanel
        saleId={sale.id}
        payments={sale.payments.map((p) => ({
          id: p.id,
          date: toDateInputValue(p.date),
          amount: p.amount.toNumber(),
          method: p.method,
        }))}
        previousBalance={previousBalance}
        totalPayable={totalPayable}
        balanceDue={balanceDue}
      />

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
        previousBalance={previousBalance}
        amountReceived={amountReceived}
      />
    </div>
  );
}
