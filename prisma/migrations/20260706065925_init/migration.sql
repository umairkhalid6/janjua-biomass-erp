-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('POPLAR', 'HARDWOOD', 'HAIDERI_PLYWOOD', 'WOOD_CHIPS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_purchases" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "materialType" "MaterialType" NOT NULL,
    "vendorId" TEXT NOT NULL,
    "weightKg" DECIMAL(12,2) NOT NULL,
    "materialCost" DECIMAL(14,2) NOT NULL,
    "handlingCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payments" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pellet_sales" (
    "id" TEXT NOT NULL,
    "invoiceNo" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "quantityBags" DECIMAL(12,2) NOT NULL,
    "ratePerBag" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pellet_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_days" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayShiftBags" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nightShiftBags" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "item" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Maintenance',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electricity_bills" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "billAmount" DECIMAL(14,2) NOT NULL,
    "unitsConsumed" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "electricity_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_rates" (
    "id" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "ratePerKg" DECIMAL(8,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contractor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_payments" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contractor_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractor_adjustments" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contractor_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "material_purchases_date_idx" ON "material_purchases"("date");

-- CreateIndex
CREATE INDEX "material_purchases_materialType_date_idx" ON "material_purchases"("materialType", "date");

-- CreateIndex
CREATE INDEX "vendor_payments_date_idx" ON "vendor_payments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "pellet_sales_invoiceNo_key" ON "pellet_sales"("invoiceNo");

-- CreateIndex
CREATE INDEX "pellet_sales_date_idx" ON "pellet_sales"("date");

-- CreateIndex
CREATE UNIQUE INDEX "production_days_date_key" ON "production_days"("date");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE UNIQUE INDEX "electricity_bills_month_key" ON "electricity_bills"("month");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_rates_effectiveFrom_key" ON "contractor_rates"("effectiveFrom");

-- CreateIndex
CREATE INDEX "contractor_payments_date_idx" ON "contractor_payments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "contractor_adjustments_date_reason_key" ON "contractor_adjustments"("date", "reason");

-- AddForeignKey
ALTER TABLE "material_purchases" ADD CONSTRAINT "material_purchases_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pellet_sales" ADD CONSTRAINT "pellet_sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pellet_sales" ADD CONSTRAINT "pellet_sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
