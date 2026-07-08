-- Fine.type, Vendor.type and VendorInvoice.category become user-extensible
-- plain strings (see OptionListItem) instead of fixed Prisma enums. Existing
-- values are preserved via an explicit ::text cast rather than drop+recreate.
ALTER TABLE "fines" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE "vendor_invoices" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;
ALTER TABLE "vendors" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

DROP TYPE "FineType";
DROP TYPE "VendorInvoiceCategory";
DROP TYPE "VendorType";
