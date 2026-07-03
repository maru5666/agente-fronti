ALTER TABLE "Company" ADD COLUMN "workspaceCode" TEXT;

UPDATE "Company"
SET "workspaceCode" = LEFT(
  REGEXP_REPLACE(LOWER(COALESCE(NULLIF("name", ''), 'empresa')), '[^a-z0-9]', '', 'g') || SUBSTRING("id" FROM 1 FOR 8),
  20
)
WHERE "workspaceCode" IS NULL;

ALTER TABLE "Company" ALTER COLUMN "workspaceCode" SET NOT NULL;

CREATE UNIQUE INDEX "Company_workspaceCode_key" ON "Company"("workspaceCode");
