-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('customer_delivery', 'store_delivery', 'staff_transport');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('planned', 'active', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "fleet_allocations" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "type" "AllocationType" NOT NULL,
    "store_id" TEXT,
    "route_id" TEXT,
    "reference" TEXT,
    "area" TEXT,
    "emirate" TEXT,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "status" "AllocationStatus" NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "fleet_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fleet_allocations_date_type_status_idx" ON "fleet_allocations"("date", "type", "status");

-- CreateIndex
CREATE INDEX "fleet_allocations_vehicle_id_date_idx" ON "fleet_allocations"("vehicle_id", "date");

-- AddForeignKey
ALTER TABLE "fleet_allocations" ADD CONSTRAINT "fleet_allocations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_allocations" ADD CONSTRAINT "fleet_allocations_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_allocations" ADD CONSTRAINT "fleet_allocations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_allocations" ADD CONSTRAINT "fleet_allocations_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
