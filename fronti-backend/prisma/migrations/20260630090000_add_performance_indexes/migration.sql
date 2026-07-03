-- Índices para lecturas críticas del dashboard, productos y operación diaria.
CREATE INDEX IF NOT EXISTS "Product_companyId_isActive_stock_idx"
ON "Product"("companyId", "isActive", "stock");

CREATE INDEX IF NOT EXISTS "Order_companyId_status_createdAt_idx"
ON "Order"("companyId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_companyId_createdAt_idx"
ON "Order"("companyId", "createdAt");
