CREATE TABLE "CompanyBranch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "phone" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyBranch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyBranch_companyId_idx" ON "CompanyBranch"("companyId");
CREATE INDEX "CompanyBranch_companyId_isActive_idx" ON "CompanyBranch"("companyId", "isActive");

ALTER TABLE "CompanyBranch" ADD CONSTRAINT "CompanyBranch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentLog" ADD COLUMN "skill" TEXT;
