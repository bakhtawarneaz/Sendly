/*
  Warnings:

  - You are about to drop the column `shopifyWebhookId` on the `StoreService` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the `CallLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FeedbackResponse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CallLog" DROP CONSTRAINT "CallLog_storeId_fkey";

-- DropForeignKey
ALTER TABLE "FeedbackResponse" DROP CONSTRAINT "FeedbackResponse_storeId_fkey";

-- AlterTable
ALTER TABLE "CampaignOrder" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Store" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "StoreService" DROP COLUMN "shopifyWebhookId";

-- AlterTable
ALTER TABLE "Template" DROP COLUMN "isActive";

-- DropTable
DROP TABLE "CallLog";

-- DropTable
DROP TABLE "FeedbackResponse";
