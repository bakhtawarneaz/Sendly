-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" BIGSERIAL NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "shopName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "currency" TEXT DEFAULT 'PKR',
    "timezone" TEXT,
    "trialStartDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "trialMessagesUsed" INTEGER NOT NULL DEFAULT 0,
    "trialMessageLimit" INTEGER NOT NULL DEFAULT 10,
    "isTrialActive" BOOLEAN NOT NULL DEFAULT true,
    "billingPlan" TEXT NOT NULL DEFAULT 'none',
    "billingStatus" TEXT NOT NULL DEFAULT 'trial',
    "shopifyChargeId" TEXT,
    "whatsappApiToken" TEXT,
    "whatsappPhoneId" TEXT,
    "whatsappBusinessId" TEXT,
    "whatsappConnected" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" BIGSERIAL NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreService" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "templateId" BIGINT,
    "shopifyWebhookId" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "orderId" TEXT,
    "orderName" TEXT,
    "customerPhone" TEXT,
    "customerName" TEXT,
    "messageType" TEXT NOT NULL,
    "templateName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "customerResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "metaTemplateId" TEXT,
    "rejectionReason" TEXT,
    "headerType" TEXT,
    "headerText" TEXT,
    "headerMediaUrl" TEXT,
    "body" TEXT NOT NULL,
    "footer" TEXT,
    "buttons" JSONB,
    "variablesMap" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetryQueue" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "messageLogId" BIGINT NOT NULL,
    "orderId" TEXT,
    "orderName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "templateName" TEXT,
    "serviceKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'failed',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "errorMessage" TEXT,
    "lastRetriedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetryQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "campaignCode" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "trackingUrl" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 7,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignOrder" (
    "id" BIGSERIAL NOT NULL,
    "campaignId" BIGINT NOT NULL,
    "storeId" BIGINT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT,
    "customerPhone" TEXT,
    "customerName" TEXT,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "attributionType" TEXT NOT NULL DEFAULT 'utm',
    "attributedAt" TIMESTAMP(3),
    "orderData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackResponse" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT,
    "rating" INTEGER,
    "reviewText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "messageLogId" BIGINT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" BIGSERIAL NOT NULL,
    "storeId" BIGINT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'its',
    "providerCallId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "action" TEXT,
    "duration" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "fallbackSent" BOOLEAN NOT NULL DEFAULT false,
    "fallbackLogId" BIGINT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_shopDomain_key" ON "Store"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Service_serviceKey_key" ON "Service"("serviceKey");

-- CreateIndex
CREATE UNIQUE INDEX "StoreService_storeId_serviceId_key" ON "StoreService"("storeId", "serviceId");

-- CreateIndex
CREATE INDEX "MessageLog_storeId_createdAt_idx" ON "MessageLog"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_storeId_serviceId_idx" ON "MessageLog"("storeId", "serviceId");

-- CreateIndex
CREATE INDEX "MessageLog_status_idx" ON "MessageLog"("status");

-- CreateIndex
CREATE INDEX "Template_status_idx" ON "Template"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Template_storeId_name_language_key" ON "Template"("storeId", "name", "language");

-- CreateIndex
CREATE INDEX "RetryQueue_storeId_status_idx" ON "RetryQueue"("storeId", "status");

-- CreateIndex
CREATE INDEX "RetryQueue_messageLogId_idx" ON "RetryQueue"("messageLogId");

-- CreateIndex
CREATE INDEX "Campaign_storeId_status_idx" ON "Campaign"("storeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_storeId_campaignCode_key" ON "Campaign"("storeId", "campaignCode");

-- CreateIndex
CREATE INDEX "CampaignOrder_campaignId_idx" ON "CampaignOrder"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignOrder_storeId_idx" ON "CampaignOrder"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignOrder_campaignId_shopifyOrderId_key" ON "CampaignOrder"("campaignId", "shopifyOrderId");

-- CreateIndex
CREATE INDEX "FeedbackResponse_storeId_customerPhone_idx" ON "FeedbackResponse"("storeId", "customerPhone");

-- CreateIndex
CREATE INDEX "FeedbackResponse_status_idx" ON "FeedbackResponse"("status");

-- CreateIndex
CREATE INDEX "CallLog_storeId_createdAt_idx" ON "CallLog"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "CallLog_storeId_status_idx" ON "CallLog"("storeId", "status");

-- CreateIndex
CREATE INDEX "CallLog_orderId_idx" ON "CallLog"("orderId");

-- AddForeignKey
ALTER TABLE "StoreService" ADD CONSTRAINT "StoreService_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreService" ADD CONSTRAINT "StoreService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetryQueue" ADD CONSTRAINT "RetryQueue_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetryQueue" ADD CONSTRAINT "RetryQueue_messageLogId_fkey" FOREIGN KEY ("messageLogId") REFERENCES "MessageLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignOrder" ADD CONSTRAINT "CampaignOrder_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignOrder" ADD CONSTRAINT "CampaignOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
