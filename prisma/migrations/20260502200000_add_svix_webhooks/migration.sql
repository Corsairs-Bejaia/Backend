-- Drop the old DIY webhook delivery table
DROP TABLE IF EXISTS "webhook_deliveries";
-- Remove old webhook columns from tenant_configs
ALTER TABLE "tenant_configs" DROP COLUMN IF EXISTS "webhook_url";
ALTER TABLE "tenant_configs" DROP COLUMN IF EXISTS "webhook_secret";
-- Add Svix application ID
ALTER TABLE "tenant_configs"
ADD COLUMN "svix_app_id" TEXT;