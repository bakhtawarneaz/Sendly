/*
  Warnings:

  - You are about to drop the column `attributionWindowDays` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `trialMessageLimit` on the `Store` table. All the data in the column will be lost.
  - You are about to drop the column `trialMessagesUsed` on the `Store` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "attributionWindowDays";

-- AlterTable
ALTER TABLE "Store" DROP COLUMN "trialMessageLimit",
DROP COLUMN "trialMessagesUsed";
