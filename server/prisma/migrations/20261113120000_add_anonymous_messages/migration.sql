-- CreateTable
CREATE TABLE "anonymous_messages" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anonymous_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anonymous_messages_groupId_createdAt_idx" ON "anonymous_messages"("groupId", "createdAt");

-- AddForeignKey
ALTER TABLE "anonymous_messages" ADD CONSTRAINT "anonymous_messages_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
