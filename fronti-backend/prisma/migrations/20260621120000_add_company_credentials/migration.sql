ALTER TABLE "Company" ADD COLUMN "email" TEXT;
ALTER TABLE "Company" ADD COLUMN "passwordHash" TEXT;

CREATE UNIQUE INDEX "Company_email_key" ON "Company"("email");
