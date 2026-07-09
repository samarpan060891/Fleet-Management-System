-- Vehicle.vehicleType and Vehicle.ownership (and the PmSchedule.vehicleType
-- it keys off) become user-extensible plain strings instead of fixed Prisma
-- enums, per explicit request to accept import values outside the original
-- fixed sets. Existing values are preserved via an explicit ::TEXT cast
-- rather than drop+recreate. A vehicle type with no matching PmSchedule row
-- already falls back to default PM intervals (see pm.service.ts), and an
-- ownership value outside owned/leased/rented simply never matches the
-- lease/rental alert check (see alerts.engine.ts) -- both degrade gracefully.
ALTER TABLE "vehicles" ALTER COLUMN "vehicle_type" TYPE TEXT USING "vehicle_type"::TEXT;
ALTER TABLE "vehicles" ALTER COLUMN "ownership" TYPE TEXT USING "ownership"::TEXT;
ALTER TABLE "vehicles" ALTER COLUMN "ownership" SET DEFAULT 'owned';
ALTER TABLE "pm_schedules" ALTER COLUMN "vehicle_type" TYPE TEXT USING "vehicle_type"::TEXT;

DROP TYPE "VehicleType";
DROP TYPE "Ownership";
