-- AlterTable
ALTER TABLE "ClinicProfile" ADD COLUMN     "bank_account" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "chair_count" INTEGER,
ADD COLUMN     "consultation_fee" DOUBLE PRECISION,
ADD COLUMN     "line_oa" TEXT;

-- AlterTable
ALTER TABLE "SeekerProfile" ADD COLUMN     "line_id" TEXT,
ADD COLUMN     "phone" TEXT;
