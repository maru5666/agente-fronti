-- CreateEnum
CREATE TYPE "InternalNotificationType" AS ENUM ('DELIVERY_REVIEW_REQUIRED', 'ORDER_CONFIRMED', 'PAYMENT_REVIEW_REQUIRED', 'HUMAN_SUPPORT_REQUIRED');

-- CreateEnum
CREATE TYPE "InternalNotificationStatus" AS ENUM ('pendiente_operador', 'en_revision', 'resuelta', 'cancelada');

-- CreateEnum
CREATE TYPE "InternalNotificationPriority" AS ENUM ('baja', 'media', 'alta', 'urgente');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'pendiente_datos';
ALTER TYPE "OrderStatus" ADD VALUE 'pendiente_confirmacion_cliente';
ALTER TYPE "OrderStatus" ADD VALUE 'pendiente_confirmacion_operador';
ALTER TYPE "OrderStatus" ADD VALUE 'pendiente_pago';
ALTER TYPE "OrderStatus" ADD VALUE 'pago_en_revision';
ALTER TYPE "OrderStatus" ADD VALUE 'pago_confirmado';
ALTER TYPE "OrderStatus" ADD VALUE 'pendiente_delivery';
ALTER TYPE "OrderStatus" ADD VALUE 'delivery_asignado';
ALTER TYPE "OrderStatus" ADD VALUE 'en_preparacion';
ALTER TYPE "OrderStatus" ADD VALUE 'en_camino';
ALTER TYPE "OrderStatus" ADD VALUE 'entregado';
ALTER TYPE "OrderStatus" ADD VALUE 'cancelado';

-- AlterTable
ALTER TABLE "DeliveryAddressCache" ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerPhone" TEXT NOT NULL,
    "fileUrl" TEXT,
    "reference" TEXT,
    "amountUsd" DECIMAL(12,2),
    "amountBs" DECIMAL(14,2),
    "status" TEXT NOT NULL DEFAULT 'pago_en_revision',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNotification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "InternalNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "InternalNotificationPriority" NOT NULL DEFAULT 'media',
    "status" "InternalNotificationStatus" NOT NULL DEFAULT 'pendiente_operador',
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerAddress" TEXT,
    "gpsLatitude" DECIMAL(10,7),
    "gpsLongitude" DECIMAL(10,7),
    "estimatedAmountUsd" DECIMAL(12,2),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentProof_companyId_idx" ON "PaymentProof"("companyId");

-- CreateIndex
CREATE INDEX "PaymentProof_companyId_customerPhone_idx" ON "PaymentProof"("companyId", "customerPhone");

-- CreateIndex
CREATE INDEX "PaymentProof_companyId_status_idx" ON "PaymentProof"("companyId", "status");

-- CreateIndex
CREATE INDEX "PaymentProof_orderId_idx" ON "PaymentProof"("orderId");

-- CreateIndex
CREATE INDEX "InternalNotification_companyId_idx" ON "InternalNotification"("companyId");

-- CreateIndex
CREATE INDEX "InternalNotification_companyId_status_idx" ON "InternalNotification"("companyId", "status");

-- CreateIndex
CREATE INDEX "InternalNotification_companyId_type_idx" ON "InternalNotification"("companyId", "type");

-- CreateIndex
CREATE INDEX "InternalNotification_companyId_createdAt_idx" ON "InternalNotification"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalNotification_orderId_idx" ON "InternalNotification"("orderId");

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNotification" ADD CONSTRAINT "InternalNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNotification" ADD CONSTRAINT "InternalNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
