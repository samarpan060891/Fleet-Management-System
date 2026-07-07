-- CreateTable
CREATE TABLE "odometer_readings" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "reading_date" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "odometer_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odometer_readings_vehicle_id_reading_date_idx" ON "odometer_readings"("vehicle_id", "reading_date");

-- AddForeignKey
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
