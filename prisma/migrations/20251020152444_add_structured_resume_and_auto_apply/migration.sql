-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "applicationPreview" JSONB,
ADD COLUMN     "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "formData" JSONB,
ADD COLUMN     "submissionError" TEXT,
ADD COLUMN     "submissionStatus" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resumeData" JSONB;
