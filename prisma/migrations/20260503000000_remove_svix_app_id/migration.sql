-- Remove the svixAppId column that was added in the previous migration.
-- The tenantId (user.id) is used directly as the Svix app UID, so nothing needs to be stored.
ALTER TABLE "tenant_configs" DROP COLUMN IF EXISTS "svix_app_id";