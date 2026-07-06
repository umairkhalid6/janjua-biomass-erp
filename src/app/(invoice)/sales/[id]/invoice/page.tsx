import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { formatDate, formatPKR, toDateInputValue } from "@/lib/format";
import { BAG_KG } from "@/lib/constants";
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
  const weightKg = quantityBags * BAG_KG;
  const invoiceLabel = `INV-${String(sale.invoiceNo).padStart(5, "0")}`;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Screen-only controls */}
      <div className="print:hidden flex items-center gap-4 border-b border-neutral-200 px-6 py-3 bg-neutral-50">
        <Link
          href="/sales"
          className="text-sm text-neutral-600 underline hover:text-neutral-900"
        >
          ← Back to Sales
        </Link>
        <PrintButton />
      </div>

      {/* Invoice body */}
      <div className="mx-auto max-w-2xl px-8 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              Janjua Biomass Pellets
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Biomass Pellet Manufacturer
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-green-700">{invoiceLabel}</p>
            <p className="mt-1 text-sm text-neutral-500">
              Date: {formatDate(toDateInputValue(sale.date))}
            </p>
          </div>
        </div>

        <hr className="mb-6 border-neutral-200" />

        {/* Customer */}
        <div className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Bill To
          </p>
          <p className="text-base font-semibold text-neutral-900">
            {sale.customer.name}
          </p>
          {sale.customer.company && (
            <p className="text-sm text-neutral-600">{sale.customer.company}</p>
          )}
          {sale.customer.phone && (
            <p className="text-sm text-neutral-600">{sale.customer.phone}</p>
          )}
        </div>

        {/* Line items */}
        <table className="mb-8 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="py-2 text-left font-semibold text-neutral-700">
                Description
              </th>
              <th className="py-2 text-right font-semibold text-neutral-700">
                Qty
              </th>
              <th className="py-2 text-right font-semibold text-neutral-700">
                Rate
              </th>
              <th className="py-2 text-right font-semibold text-neutral-700">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100">
              <td className="py-3 text-neutral-700">
                Biomass Pellets
                <br />
                <span className="text-xs text-neutral-400">
                  {quantityBags.toFixed(2)} bags × {BAG_KG} kg/bag ={" "}
                  {weightKg.toFixed(2)} kg
                </span>
              </td>
              <td className="py-3 text-right text-neutral-700">
                {quantityBags.toFixed(2)} bags
              </td>
              <td className="py-3 text-right text-neutral-700">
                {formatPKR(ratePerBag)}/bag
              </td>
              <td className="py-3 text-right font-semibold text-neutral-900">
                {formatPKR(amount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Total */}
        <div className="mb-8 flex justify-end">
          <div className="w-64">
            <div className="flex justify-between border-t-2 border-neutral-900 pt-2">
              <span className="font-bold text-neutral-900">Total (PKR)</span>
              <span className="font-bold text-neutral-900">
                {formatPKR(amount)}
              </span>
            </div>
          </div>
        </div>

        {sale.notes && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
            <span className="font-medium">Notes:</span> {sale.notes}
          </div>
        )}

        <div className="mt-12 text-center text-xs text-neutral-400">
          Thank you for your business!
        </div>
      </div>
    </div>
  );
}
