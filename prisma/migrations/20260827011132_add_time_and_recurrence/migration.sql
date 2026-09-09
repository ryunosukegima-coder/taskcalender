-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "isAllDay" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "recurrenceRule" TEXT,
ADD COLUMN     "startTime" TEXT;
