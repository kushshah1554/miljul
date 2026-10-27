-- CreateEnum
CREATE TYPE "ChoreStatus" AS ENUM ('ACTIVE', 'PAUSED', 'NEEDS_ATTENTION', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChoreAssignmentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SKIPPED', 'WAIVED');

-- CreateEnum
CREATE TYPE "ChoreSkipMode" AS ENUM ('DEFER', 'FORFEIT');

-- CreateEnum
CREATE TYPE "ChoreReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChoreFineReason" AS ENUM ('OVERDUE', 'QUALITY');

-- CreateEnum
CREATE TYPE "ChoreFineStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "choresPausedAt" TIMESTAMP(3),
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kathmandu';

-- CreateTable
CREATE TABLE "chores" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "intervalDays" INTEGER NOT NULL,
    "deadlineMinutes" INTEGER NOT NULL DEFAULT 690,
    "finePerMember" DECIMAL(12,2) NOT NULL DEFAULT 20,
    "status" "ChoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "frozenAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentAssignmentId" TEXT,

    CONSTRAINT "chores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_participants" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "unavailableUntil" TIMESTAMP(3),
    "unavailableReason" TEXT,

    CONSTRAINT "chore_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_cycles" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "order" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "chore_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_assignments" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" "ChoreAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "firstSubmittedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submissionNote" TEXT,
    "skipRequestedAt" TIMESTAMP(3),
    "skipRequestReason" TEXT,
    "skipMode" "ChoreSkipMode",
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chore_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_checklist_items" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "chore_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_reviews" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ChoreReviewDecision" NOT NULL,
    "results" JSONB NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chore_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_fines" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "reasons" "ChoreFineReason"[],
    "status" "ChoreFineStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chore_fines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_fine_shares" (
    "id" TEXT NOT NULL,
    "fineId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "chore_fine_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_pauses" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "choreId" TEXT,
    "pausedById" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "resumedById" TEXT,
    "resumedAt" TIMESTAMP(3),
    "resumeReason" TEXT,

    CONSTRAINT "chore_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chores_currentAssignmentId_key" ON "chores"("currentAssignmentId");

-- CreateIndex
CREATE INDEX "chores_groupId_status_idx" ON "chores"("groupId", "status");

-- CreateIndex
CREATE INDEX "chores_createdById_idx" ON "chores"("createdById");

-- CreateIndex
CREATE INDEX "chore_participants_userId_idx" ON "chore_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chore_participants_choreId_userId_key" ON "chore_participants"("choreId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "chore_cycles_choreId_number_key" ON "chore_cycles"("choreId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "chore_assignments_replacedById_key" ON "chore_assignments"("replacedById");

-- CreateIndex
CREATE INDEX "chore_assignments_choreId_startsAt_idx" ON "chore_assignments"("choreId", "startsAt");

-- CreateIndex
CREATE INDEX "chore_assignments_cycleId_idx" ON "chore_assignments"("cycleId");

-- CreateIndex
CREATE INDEX "chore_assignments_userId_status_idx" ON "chore_assignments"("userId", "status");

-- CreateIndex
CREATE INDEX "chore_assignments_status_deadlineAt_idx" ON "chore_assignments"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "chore_checklist_items_choreId_position_idx" ON "chore_checklist_items"("choreId", "position");

-- CreateIndex
CREATE INDEX "chore_reviews_assignmentId_createdAt_idx" ON "chore_reviews"("assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "chore_reviews_reviewerId_idx" ON "chore_reviews"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "chore_fines_assignmentId_key" ON "chore_fines"("assignmentId");

-- CreateIndex
CREATE INDEX "chore_fines_payerId_idx" ON "chore_fines"("payerId");

-- CreateIndex
CREATE INDEX "chore_fine_shares_recipientId_idx" ON "chore_fine_shares"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "chore_fine_shares_fineId_recipientId_key" ON "chore_fine_shares"("fineId", "recipientId");

-- CreateIndex
CREATE INDEX "chore_pauses_groupId_choreId_resumedAt_idx" ON "chore_pauses"("groupId", "choreId", "resumedAt");

-- AddForeignKey
ALTER TABLE "chores" ADD CONSTRAINT "chores_currentAssignmentId_fkey" FOREIGN KEY ("currentAssignmentId") REFERENCES "chore_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chores" ADD CONSTRAINT "chores_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chores" ADD CONSTRAINT "chores_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_participants" ADD CONSTRAINT "chore_participants_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_participants" ADD CONSTRAINT "chore_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_cycles" ADD CONSTRAINT "chore_cycles_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "chore_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_assignments" ADD CONSTRAINT "chore_assignments_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "chore_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_checklist_items" ADD CONSTRAINT "chore_checklist_items_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_reviews" ADD CONSTRAINT "chore_reviews_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "chore_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_reviews" ADD CONSTRAINT "chore_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_fines" ADD CONSTRAINT "chore_fines_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "chore_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_fines" ADD CONSTRAINT "chore_fines_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_fines" ADD CONSTRAINT "chore_fines_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_fine_shares" ADD CONSTRAINT "chore_fine_shares_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "chore_fines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_fine_shares" ADD CONSTRAINT "chore_fine_shares_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_pauses" ADD CONSTRAINT "chore_pauses_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_pauses" ADD CONSTRAINT "chore_pauses_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_pauses" ADD CONSTRAINT "chore_pauses_pausedById_fkey" FOREIGN KEY ("pausedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_pauses" ADD CONSTRAINT "chore_pauses_resumedById_fkey" FOREIGN KEY ("resumedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
