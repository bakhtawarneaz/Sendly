-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "judgeMeApiToken" TEXT,
ADD COLUMN     "judgeMeShopDomain" TEXT,
ADD COLUMN     "reviewRequestDelayUnit" TEXT DEFAULT 'days',
ADD COLUMN     "reviewRequestDelayValue" INTEGER DEFAULT 3;

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "productId" TEXT,
    "productHandle" TEXT,
    "customerPhone" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "rating" INTEGER,
    "reviewText" TEXT,
    "whatsappMessageId" TEXT,
    "requestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewRequest_storeId_status_idx" ON "ReviewRequest"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequest_storeId_orderId_key" ON "ReviewRequest"("storeId", "orderId");

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
