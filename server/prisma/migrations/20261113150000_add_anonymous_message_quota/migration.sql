-- CreateTable
CREATE TABLE "anonymous_message_quotas" (
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "anonymous_message_quotas_pkey" PRIMARY KEY ("userId","groupId","day")
);

-- CreateIndex
CREATE INDEX "anonymous_message_quotas_groupId_idx" ON "anonymous_message_quotas"("groupId");

-- AddForeignKey
ALTER TABLE "anonymous_message_quotas" ADD CONSTRAINT "anonymous_message_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_message_quotas" ADD CONSTRAINT "anonymous_message_quotas_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
