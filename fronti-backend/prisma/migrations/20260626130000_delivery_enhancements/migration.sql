ALTER TABLE "Company"
ADD COLUMN "establishmentName" TEXT,
ADD COLUMN "establishmentAddress" TEXT,
ADD COLUMN "establishmentLatitude" DECIMAL(10,7),
ADD COLUMN "establishmentLongitude" DECIMAL(10,7),
ADD COLUMN "googleMapsReference" TEXT,
ADD COLUMN "baseDeliveryZone" TEXT,
ADD COLUMN "deliveryBaseFeeUsd" DECIMAL(12,2),
ADD COLUMN "deliveryPricePerKmUsd" DECIMAL(12,2),
ADD COLUMN "deliveryMinimumFeeUsd" DECIMAL(12,2),
ADD COLUMN "deliveryFarZoneSurchargeUsd" DECIMAL(12,2),
ADD COLUMN "deliveryFreeFromUsd" DECIMAL(12,2);

ALTER TABLE "DeliveryZone"
ADD COLUMN "description" TEXT,
ADD COLUMN "fixedFeeUsd" DECIMAL(12,2),
ADD COLUMN "pricePerKmUsd" DECIMAL(12,2),
ADD COLUMN "minDistanceKm" DECIMAL(8,2),
ADD COLUMN "color" TEXT,
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "localLatitude" DECIMAL(10,7),
ADD COLUMN "localLongitude" DECIMAL(10,7),
ADD COLUMN "localRadiusKm" DECIMAL(8,2);

CREATE TABLE "DeliveryAddressCache" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "normalizedQuery" TEXT NOT NULL,
  "formattedAddress" TEXT NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryAddressCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryAddressCache_companyId_normalizedQuery_key" ON "DeliveryAddressCache"("companyId", "normalizedQuery");
CREATE INDEX "DeliveryAddressCache_companyId_idx" ON "DeliveryAddressCache"("companyId");
CREATE INDEX "DeliveryZone_companyId_priority_idx" ON "DeliveryZone"("companyId", "priority");

ALTER TABLE "DeliveryAddressCache"
ADD CONSTRAINT "DeliveryAddressCache_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
