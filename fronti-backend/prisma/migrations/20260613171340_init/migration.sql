-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('CUSTOMER', 'BUSINESS', 'FRONTI');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'paid', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rif" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "priceUsd" DECIMAL(12,2) NOT NULL,
    "priceBs" DECIMAL(14,2) NOT NULL,
    "stock" INTEGER NOT NULL,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "totalUsd" DECIMAL(12,2) NOT NULL,
    "totalBs" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceUsd" DECIMAL(12,2) NOT NULL,
    "unitPriceBs" DECIMAL(14,2) NOT NULL,
    "subtotalUsd" DECIMAL(12,2) NOT NULL,
    "subtotalBs" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL DEFAULT 'CUSTOMER',
    "senderPhone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceUsd" DECIMAL(12,2) NOT NULL,
    "priceBs" DECIMAL(14,2) NOT NULL,
    "estimatedTime" TEXT NOT NULL,
    "maxDistanceKm" DECIMAL(8,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "customerAddress" TEXT,
    "customerLatitude" DECIMAL(10,7),
    "customerLongitude" DECIMAL(10,7),
    "validatedAddress" TEXT,
    "deliveryZoneId" TEXT,
    "paymentMethodId" TEXT,
    "subtotalUsd" DECIMAL(12,2) NOT NULL,
    "subtotalBs" DECIMAL(14,2) NOT NULL,
    "deliveryFeeUsd" DECIMAL(12,2) NOT NULL,
    "deliveryFeeBs" DECIMAL(14,2) NOT NULL,
    "totalUsd" DECIMAL(12,2) NOT NULL,
    "totalBs" DECIMAL(14,2) NOT NULL,
    "distanceKm" DECIMAL(8,2),
    "estimatedDeliveryMinutes" INTEGER,
    "googleMapsLink" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "stockDiscounted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceUsd" DECIMAL(12,2) NOT NULL,
    "unitPriceBs" DECIMAL(14,2) NOT NULL,
    "subtotalUsd" DECIMAL(12,2) NOT NULL,
    "subtotalBs" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_rif_key" ON "Company"("rif");

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE INDEX "Product_companyId_name_idx" ON "Product"("companyId", "name");

-- CreateIndex
CREATE INDEX "Product_companyId_stock_idx" ON "Product"("companyId", "stock");

-- CreateIndex
CREATE INDEX "Promotion_companyId_idx" ON "Promotion"("companyId");

-- CreateIndex
CREATE INDEX "Promotion_companyId_isActive_startDate_endDate_idx" ON "Promotion"("companyId", "isActive", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Sale_companyId_idx" ON "Sale"("companyId");

-- CreateIndex
CREATE INDEX "Sale_companyId_createdAt_idx" ON "Sale"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "ChatMessage_companyId_idx" ON "ChatMessage"("companyId");

-- CreateIndex
CREATE INDEX "ChatMessage_companyId_senderPhone_idx" ON "ChatMessage"("companyId", "senderPhone");

-- CreateIndex
CREATE INDEX "PaymentMethod_companyId_idx" ON "PaymentMethod"("companyId");

-- CreateIndex
CREATE INDEX "PaymentMethod_companyId_isActive_idx" ON "PaymentMethod"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "DeliveryZone_companyId_idx" ON "DeliveryZone"("companyId");

-- CreateIndex
CREATE INDEX "DeliveryZone_companyId_isActive_idx" ON "DeliveryZone"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "Order_companyId_idx" ON "Order"("companyId");

-- CreateIndex
CREATE INDEX "Order_companyId_status_idx" ON "Order"("companyId", "status");

-- CreateIndex
CREATE INDEX "Order_companyId_customerPhone_idx" ON "Order"("companyId", "customerPhone");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "CustomerAddress_companyId_customerPhone_idx" ON "CustomerAddress"("companyId", "customerPhone");

-- CreateIndex
CREATE INDEX "CustomerAddress_companyId_customerPhone_isFavorite_idx" ON "CustomerAddress"("companyId", "customerPhone", "isFavorite");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
