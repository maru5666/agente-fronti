ALTER TABLE "DeliveryZone"
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "distanceFromCompanyKm" DECIMAL(8,2),
ADD COLUMN "polygonCoordinates" JSONB;
