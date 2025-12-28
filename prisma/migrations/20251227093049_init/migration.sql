-- DropForeignKey
ALTER TABLE "consultations" DROP CONSTRAINT "consultations_slotId_fkey";

-- AlterTable
ALTER TABLE "consultations" ALTER COLUMN "slotId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "availability_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
