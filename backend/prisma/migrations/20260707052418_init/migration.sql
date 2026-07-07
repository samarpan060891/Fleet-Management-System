-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FLEET_MANAGER', 'WORKSHOP', 'COMPLIANCE', 'FINANCE', 'TRANSPORT_COORDINATOR', 'OPS_DELIVERY', 'DELIVERY_MANAGER', 'WAREHOUSE_MANAGER', 'DRIVER', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('light', 'sedan', 'pickup', 'truck_3_7t', 'bus', 'van');

-- CreateEnum
CREATE TYPE "Ownership" AS ENUM ('owned', 'leased', 'rented');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('active', 'in_workshop', 'vor', 'idle', 'disposed');

-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('workshop', 'tyre_supplier', 'insurance', 'fuel_supplier', 'spare_parts', 'lessor', 'other');

-- CreateEnum
CREATE TYPE "FuelChannel" AS ENUM ('vip_kit', 'fuel_buddy', 'cash');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('scheduled', 'breakdown', 'accident', 'tyre');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('open', 'in_progress', 'closed');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('reported', 'under_review', 'approved', 'rejected', 'settled');

-- CreateEnum
CREATE TYPE "FineType" AS ENUM ('salik', 'speeding', 'parking', 'other');

-- CreateEnum
CREATE TYPE "FineStatus" AS ENUM ('unpaid', 'paid');

-- CreateEnum
CREATE TYPE "DisposalMethod" AS ENUM ('sold', 'scrapped', 'returned_to_lessor');

-- CreateEnum
CREATE TYPE "DocumentEntity" AS ENUM ('vehicle', 'driver');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('mulkiya', 'insurance', 'tasjeel', 'lease', 'warranty', 'licence', 'emirates_id', 'visa', 'passport');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('green', 'amber', 'red');

-- CreateEnum
CREATE TYPE "AlertCategory" AS ENUM ('compliance_expiry', 'maintenance_due', 'fuel_anomaly', 'fine_aging', 'salik_low', 'downtime_vor', 'contract_warranty', 'transport');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent');

-- CreateEnum
CREATE TYPE "AttendanceMarkedBy" AS ENUM ('coordinator', 'driver');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "driver_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "plate_emirate" TEXT NOT NULL,
    "plate_category" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vin" TEXT,
    "engine_number" TEXT,
    "colour" TEXT,
    "vehicle_type" "VehicleType" NOT NULL,
    "body_type" TEXT,
    "seating_capacity" INTEGER,
    "payload_kg" INTEGER,
    "ownership" "Ownership" NOT NULL DEFAULT 'owned',
    "lease_start" TIMESTAMP(3),
    "lease_end" TIMESTAMP(3),
    "monthly_cost" DECIMAL(12,2),
    "lessor_id" TEXT,
    "gps_unit_id" TEXT,
    "fuel_kit_id" TEXT,
    "current_odometer" INTEGER NOT NULL DEFAULT 0,
    "store_id" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'active',
    "warranty_end_date" TIMESTAMP(3),
    "warranty_end_km" INTEGER,
    "useful_life_years" INTEGER,
    "residual_value" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "blood_group" TEXT,
    "nationality" TEXT,
    "joining_date" TIMESTAMP(3),
    "emergency_contact" TEXT,
    "photo_key" TEXT,
    "licence_number" TEXT,
    "licence_class" TEXT,
    "licence_expiry" TIMESTAMP(3),
    "emirates_id" TEXT,
    "emirates_id_expiry" TIMESTAMP(3),
    "visa_expiry" TIMESTAMP(3),
    "passport_number" TEXT,
    "passport_expiry" TIMESTAMP(3),
    "default_vehicle_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "type" "VendorType" NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "trn" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emirate" TEXT NOT NULL,
    "address" TEXT,
    "contact" TEXT,
    "delivery_window" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "pickup_point" TEXT,
    "home_camp" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_driver_assignments" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "vehicle_driver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_documents" (
    "id" TEXT NOT NULL,
    "entity_type" "DocumentEntity" NOT NULL,
    "vehicle_id" TEXT,
    "driver_id" TEXT,
    "doc_type" "DocType" NOT NULL,
    "reference" TEXT,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "file_key" TEXT,
    "renewal_in_progress" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "compliance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_transactions" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "filled_at" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER,
    "litres" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(10,3),
    "channel" "FuelChannel" NOT NULL,
    "driver_id" TEXT,
    "km_since_last" INTEGER,
    "km_per_litre" DECIMAL(8,3),
    "approval_status" "ApprovalStatus",
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "import_batch_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "fuel_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_cards" (
    "id" TEXT NOT NULL,
    "job_number" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "odometer_in" INTEGER,
    "odometer_out" INTEGER,
    "date_in" TIMESTAMP(3) NOT NULL,
    "date_out" TIMESTAMP(3),
    "downtime_days" INTEGER,
    "type" "JobType" NOT NULL,
    "description" TEXT,
    "vendor_id" TEXT,
    "invoice_number" TEXT,
    "invoice_key" TEXT,
    "labour_charges" DECIMAL(12,2),
    "other_charges" DECIMAL(12,2),
    "total_cost" DECIMAL(12,2),
    "is_warranty_claim" BOOLEAN NOT NULL DEFAULT false,
    "status" "JobStatus" NOT NULL DEFAULT 'open',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_card_parts" (
    "id" TEXT NOT NULL,
    "job_card_id" TEXT NOT NULL,
    "part_name" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "job_card_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_schedules" (
    "id" TEXT NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "km_interval" INTEGER NOT NULL,
    "time_interval_days" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "pm_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_states" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "last_pm_km" INTEGER,
    "last_pm_date" TIMESTAMP(3),
    "next_pm_km" INTEGER,
    "next_pm_date" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pm_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tyres" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "brand" TEXT,
    "vehicle_id" TEXT,
    "position" TEXT,
    "fitment_date" TIMESTAMP(3),
    "fitment_odometer" INTEGER,
    "tread_depth_mm" DECIMAL(5,2),
    "scrap_date" TIMESTAMP(3),
    "scrap_reason" TEXT,
    "vendor_id" TEXT,
    "cost" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "tyres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tyre_tread_checks" (
    "id" TEXT NOT NULL,
    "tyre_id" TEXT NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL,
    "depth_mm" DECIMAL(5,2) NOT NULL,
    "note" TEXT,

    CONSTRAINT "tyre_tread_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "emirate" TEXT,
    "area" TEXT,
    "description" TEXT,
    "police_report_no" TEXT,
    "third_party" TEXT,
    "insurance_vendor_id" TEXT,
    "claim_status" "ClaimStatus" NOT NULL DEFAULT 'reported',
    "claim_amount" DECIMAL(12,2),
    "settlement_amount" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_photos" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "caption" TEXT,

    CONSTRAINT "incident_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fines" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "offence_at" TIMESTAMP(3) NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "type" "FineType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "authority" TEXT,
    "emirate" TEXT,
    "status" "FineStatus" NOT NULL DEFAULT 'unpaid',
    "payment_date" TIMESTAMP(3),
    "driver_id" TEXT,
    "driver_overridden" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "fines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salik_tags" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "tag_number" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "low_threshold" DECIMAL(12,2) NOT NULL DEFAULT 20,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "salik_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_purchases" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "supplier_id" TEXT,
    "purchase_price" DECIMAL(14,2) NOT NULL,
    "invoice_key" TEXT,
    "financing" TEXT,
    "useful_life_years" INTEGER,
    "residual_value" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "vehicle_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_disposals" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "disposal_date" TIMESTAMP(3) NOT NULL,
    "method" "DisposalMethod" NOT NULL,
    "buyer" TEXT,
    "sale_price" DECIMAL(14,2),
    "book_value" DECIMAL(14,2),
    "gain_loss" DECIMAL(14,2),
    "documents_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "vehicle_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT,
    "scheduled_time" TEXT,
    "vehicle_id" TEXT,
    "driver_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_assignments" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "driver_id" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "route_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_employees" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "pickup_point" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "route_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "marked_by" "AttendanceMarkedBy" NOT NULL,
    "marked_by_user_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "stock_on_hand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorder_level" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "supplier_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_movements" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "part_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "category" "AlertCategory" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "driver_id" TEXT,
    "route_id" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "due_date" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "last_notified_at" TIMESTAMP(3),
    "notify_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT,
    "label" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT,
    "user_email" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_driver_id_key" ON "users"("driver_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_vehicle_type_idx" ON "vehicles"("vehicle_type");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_plate_emirate_key" ON "vehicles"("plate_number", "plate_emirate");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_staff_id_key" ON "drivers"("staff_id");

-- CreateIndex
CREATE INDEX "drivers_status_idx" ON "drivers"("status");

-- CreateIndex
CREATE INDEX "vendors_type_idx" ON "vendors"("type");

-- CreateIndex
CREATE UNIQUE INDEX "stores_code_key" ON "stores"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_staff_id_key" ON "employees"("staff_id");

-- CreateIndex
CREATE INDEX "vehicle_driver_assignments_vehicle_id_effective_from_idx" ON "vehicle_driver_assignments"("vehicle_id", "effective_from");

-- CreateIndex
CREATE INDEX "vehicle_driver_assignments_driver_id_effective_from_idx" ON "vehicle_driver_assignments"("driver_id", "effective_from");

-- CreateIndex
CREATE INDEX "compliance_documents_expiry_date_idx" ON "compliance_documents"("expiry_date");

-- CreateIndex
CREATE INDEX "compliance_documents_vehicle_id_idx" ON "compliance_documents"("vehicle_id");

-- CreateIndex
CREATE INDEX "compliance_documents_driver_id_idx" ON "compliance_documents"("driver_id");

-- CreateIndex
CREATE INDEX "fuel_transactions_vehicle_id_filled_at_idx" ON "fuel_transactions"("vehicle_id", "filled_at");

-- CreateIndex
CREATE INDEX "fuel_transactions_channel_approval_status_idx" ON "fuel_transactions"("channel", "approval_status");

-- CreateIndex
CREATE UNIQUE INDEX "job_cards_job_number_key" ON "job_cards"("job_number");

-- CreateIndex
CREATE INDEX "job_cards_vehicle_id_date_in_idx" ON "job_cards"("vehicle_id", "date_in");

-- CreateIndex
CREATE INDEX "job_cards_status_idx" ON "job_cards"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pm_schedules_vehicle_type_key" ON "pm_schedules"("vehicle_type");

-- CreateIndex
CREATE UNIQUE INDEX "pm_states_vehicle_id_key" ON "pm_states"("vehicle_id");

-- CreateIndex
CREATE INDEX "tyres_vehicle_id_idx" ON "tyres"("vehicle_id");

-- CreateIndex
CREATE INDEX "incidents_vehicle_id_occurred_at_idx" ON "incidents"("vehicle_id", "occurred_at");

-- CreateIndex
CREATE INDEX "incidents_claim_status_idx" ON "incidents"("claim_status");

-- CreateIndex
CREATE INDEX "fines_vehicle_id_offence_at_idx" ON "fines"("vehicle_id", "offence_at");

-- CreateIndex
CREATE INDEX "fines_status_idx" ON "fines"("status");

-- CreateIndex
CREATE UNIQUE INDEX "salik_tags_vehicle_id_key" ON "salik_tags"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_purchases_vehicle_id_key" ON "vehicle_purchases"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_disposals_vehicle_id_key" ON "vehicle_disposals"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "routes_code_key" ON "routes"("code");

-- CreateIndex
CREATE INDEX "route_assignments_route_id_effective_from_idx" ON "route_assignments"("route_id", "effective_from");

-- CreateIndex
CREATE INDEX "route_employees_route_id_idx" ON "route_employees"("route_id");

-- CreateIndex
CREATE INDEX "route_employees_employee_id_idx" ON "route_employees"("employee_id");

-- CreateIndex
CREATE INDEX "attendance_date_idx" ON "attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_route_id_employee_id_date_key" ON "attendance"("route_id", "employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "parts_code_key" ON "parts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_dedupe_key_key" ON "alerts"("dedupe_key");

-- CreateIndex
CREATE INDEX "alerts_category_severity_resolved_idx" ON "alerts"("category", "severity", "resolved");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_lessor_id_fkey" FOREIGN KEY ("lessor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_driver_assignments" ADD CONSTRAINT "vehicle_driver_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_driver_assignments" ADD CONSTRAINT "vehicle_driver_assignments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_parts" ADD CONSTRAINT "job_card_parts_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_states" ADD CONSTRAINT "pm_states_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyres" ADD CONSTRAINT "tyres_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyres" ADD CONSTRAINT "tyres_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tyre_tread_checks" ADD CONSTRAINT "tyre_tread_checks_tyre_id_fkey" FOREIGN KEY ("tyre_id") REFERENCES "tyres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_insurance_vendor_id_fkey" FOREIGN KEY ("insurance_vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_photos" ADD CONSTRAINT "incident_photos_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fines" ADD CONSTRAINT "fines_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salik_tags" ADD CONSTRAINT "salik_tags_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_purchases" ADD CONSTRAINT "vehicle_purchases_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_purchases" ADD CONSTRAINT "vehicle_purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_disposals" ADD CONSTRAINT "vehicle_disposals_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_assignments" ADD CONSTRAINT "route_assignments_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_employees" ADD CONSTRAINT "route_employees_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_employees" ADD CONSTRAINT "route_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_movements" ADD CONSTRAINT "part_movements_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
