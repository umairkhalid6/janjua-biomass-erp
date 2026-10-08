-- CreateTable
CREATE TABLE "custom_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNo" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT,
    "customerPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantityBags" DECIMAL(12,2) NOT NULL,
    "bagSizeKg" DECIMAL(10,2) NOT NULL,
    "ratePerKg" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "custom_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_invoices_invoiceNo_key" ON "custom_invoices"("invoiceNo");

-- CreateIndex
CREATE INDEX "custom_invoices_date_idx" ON "custom_invoices"("date");

-- CreateIndex
CREATE INDEX "custom_invoice_items_invoiceId_idx" ON "custom_invoice_items"("invoiceId");

-- AddForeignKey
ALTER TABLE "custom_invoice_items" ADD CONSTRAINT "custom_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "custom_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
