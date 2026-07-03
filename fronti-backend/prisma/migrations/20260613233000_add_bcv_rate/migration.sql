CREATE TABLE "BcvRate" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" DECIMAL(14,6) NOT NULL,
    "source" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BcvRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BcvRate_currency_publishedAt_idx" ON "BcvRate"("currency", "publishedAt");
CREATE INDEX "BcvRate_currency_fetchedAt_idx" ON "BcvRate"("currency", "fetchedAt");
