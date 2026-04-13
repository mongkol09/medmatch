-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "sub_specialties_required" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "SeekerProfile" ADD COLUMN     "sub_specialties" JSONB NOT NULL DEFAULT '[]';
