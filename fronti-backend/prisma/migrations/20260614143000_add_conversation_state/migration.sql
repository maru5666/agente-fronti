CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "currentIntent" TEXT,
    "awaitingField" TEXT,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationState_companyId_senderPhone_key" ON "ConversationState"("companyId", "senderPhone");
CREATE INDEX "ConversationState_companyId_idx" ON "ConversationState"("companyId");
CREATE INDEX "ConversationState_companyId_senderPhone_idx" ON "ConversationState"("companyId", "senderPhone");

ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
