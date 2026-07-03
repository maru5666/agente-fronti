CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "toolResult" JSONB,
    "generatedResponse" TEXT NOT NULL,
    "criticReview" JSONB,
    "finalResponse" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentLog_companyId_idx" ON "AgentLog"("companyId");
CREATE INDEX "AgentLog_companyId_senderPhone_idx" ON "AgentLog"("companyId", "senderPhone");
CREATE INDEX "AgentLog_companyId_createdAt_idx" ON "AgentLog"("companyId", "createdAt");

ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
