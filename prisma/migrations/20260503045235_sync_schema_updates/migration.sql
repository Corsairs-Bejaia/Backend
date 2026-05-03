/*
  Warnings:

  - You are about to drop the column `webhook_secret` on the `tenant_configs` table. All the data in the column will be lost.
  - You are about to drop the column `webhook_url` on the `tenant_configs` table. All the data in the column will be lost.
  - You are about to drop the `webhook_deliveries` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[tenant_id,national_id_number]` on the table `doctors` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[session_token]` on the table `verifications` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "webhook_deliveries_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "webhook_deliveries_verification_id_fkey";

-- AlterTable
ALTER TABLE "tenant_configs" DROP COLUMN "webhook_secret",
DROP COLUMN "webhook_url";

-- AlterTable
ALTER TABLE "verifications" ADD COLUMN     "redirect_url" TEXT,
ADD COLUMN     "session_expires_at" TIMESTAMP(3),
ADD COLUMN     "session_token" TEXT;

-- DropTable
DROP TABLE "webhook_deliveries";

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "event_types" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "svix_endpoint_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctors_tenant_id_national_id_number_key" ON "doctors"("tenant_id", "national_id_number");

-- CreateIndex
CREATE UNIQUE INDEX "verifications_session_token_key" ON "verifications"("session_token");

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
