-- AlterTable
ALTER TABLE "anonymous_messages" ADD COLUMN     "editTokenHash" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3);
