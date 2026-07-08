-- AlterTable
ALTER TABLE "odometer_readings" ADD COLUMN     "trip_end_at" TIMESTAMP(3),
ADD COLUMN     "trip_end_km" INTEGER,
ADD COLUMN     "trip_start_at" TIMESTAMP(3),
ADD COLUMN     "trip_start_km" INTEGER;
