CREATE TABLE "Brand" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logo" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN "brandId" TEXT;
ALTER TABLE "Product" ADD COLUMN "mainImage" TEXT;
ALTER TABLE "Product" ADD COLUMN "coverImage" TEXT;
ALTER TABLE "Product" ADD COLUMN "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "Brand_companyId_name_key" ON "Brand"("companyId", "name");
CREATE INDEX "Brand_companyId_idx" ON "Brand"("companyId");
CREATE INDEX "Product_companyId_brandId_idx" ON "Product"("companyId", "brandId");

ALTER TABLE "Brand" ADD CONSTRAINT "Brand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
