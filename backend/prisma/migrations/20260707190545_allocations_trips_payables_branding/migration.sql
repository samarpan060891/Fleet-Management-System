-- CreateEnum
CREATE TYPE "VendorInvoiceCategory" AS ENUM ('maintenance', 'tyre', 'insurance', 'permit', 'branding', 'salik', 'other');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('unpaid', 'partial', 'paid');

-- AlterEnum
ALTER TYPE "DocType" ADD VALUE 'permit';

-- AlterTable
ALTER TABLE "fleet_allocations" ADD COLUMN     "trip_end_at" TIMESTAMP(3),
ADD COLUMN     "trip_start_at" TIMESTAMP(3),
ADD COLUMN     "waiting_minutes" INTEGER;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "branding_notes" TEXT,
ADD COLUMN     "has_branding" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "vendor_invoices" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "category" "VendorInvoiceCategory" NOT NULL,
    "invoice_number" TEXT,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'unpaid',
    "payment_date" TIMESTAMP(3),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "vendor_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_invoices_vendor_id_status_idx" ON "vendor_invoices"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "vendor_invoices_status_due_date_idx" ON "vendor_invoices"("status", "due_date");

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invoices" ADD CONSTRAINT "vendor_invoices_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
