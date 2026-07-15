-- CreateTable
CREATE TABLE "AbandonedCheckout" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "shopifyCheckoutId" TEXT,
    "checkoutToken" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "cartItems" JSONB,
    "cartTotal" DECIMAL(12,2) DEFAULT 0,
    "currency" TEXT DEFAULT 'USD',
    "recoveryUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "recoveredAt" TIMESTAMP(3),
    "recoveredOrderId" TEXT,
    "recoveredOrderTotal" DECIMAL(12,2),
    "source" TEXT NOT NULL DEFAULT 'webhook',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbandonedCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbandonedReminder" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "abandonedCheckoutId" BIGINT NOT NULL,
    "reminderNumber" INTEGER NOT NULL,
    "templateId" BIGINT,
    "templateName" TEXT,
    "discountCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "bullmqJobId" TEXT,
    "whatsappMessageId" TEXT,
    "messageBody" TEXT,
    "errorMessage" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbandonedReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbandonedCheckout_storeId_status_idx" ON "AbandonedCheckout"("storeId", "status");

-- CreateIndex
CREATE INDEX "AbandonedCheckout_storeId_createdAt_idx" ON "AbandonedCheckout"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "AbandonedCheckout_status_expiresAt_idx" ON "AbandonedCheckout"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCheckout_storeId_checkoutToken_key" ON "AbandonedCheckout"("storeId", "checkoutToken");

-- CreateIndex
CREATE INDEX "AbandonedReminder_storeId_status_idx" ON "AbandonedReminder"("storeId", "status");

-- CreateIndex
CREATE INDEX "AbandonedReminder_abandonedCheckoutId_idx" ON "AbandonedReminder"("abandonedCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedReminder_abandonedCheckoutId_reminderNumber_key" ON "AbandonedReminder"("abandonedCheckoutId", "reminderNumber");

-- AddForeignKey
ALTER TABLE "AbandonedCheckout" ADD CONSTRAINT "AbandonedCheckout_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbandonedReminder" ADD CONSTRAINT "AbandonedReminder_abandonedCheckoutId_fkey" FOREIGN KEY ("abandonedCheckoutId") REFERENCES "AbandonedCheckout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
