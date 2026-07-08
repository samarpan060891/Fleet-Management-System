-- AlterEnum
ALTER TYPE "AttendanceMarkedBy" ADD VALUE 'staff';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "reached_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "route_employees" ADD COLUMN     "sequence" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "employee_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

