-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "plan_tier" TEXT NOT NULL DEFAULT 'free',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY['verifications:read', 'verifications:write']::TEXT[],
    "rate_limit" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "full_name_fr" TEXT NOT NULL,
    "full_name_ar" TEXT,
    "national_id_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "workflow_config_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "score" DOUBLE PRECISION,
    "decision" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_steps" (
    "id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "step_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result_json" JSONB,
    "confidence" DOUBLE PRECISION,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "verification_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "description" TEXT,
    "sample_image_url" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "fields_schema_json" JSONB,
    "field_positions_json" JSONB,
    "validation_rules_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_template_fields" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "field_label_fr" TEXT NOT NULL,
    "field_label_ar" TEXT,
    "field_type" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "position_hint_json" JSONB,
    "validation_regex" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "template_id" TEXT,
    "file_path" TEXT NOT NULL,
    "ocr_result_json" JSONB,
    "authenticity_score" DOUBLE PRECISION,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details_json" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "response_code" INTEGER,
    "last_attempt_at" TIMESTAMP(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "required_steps_json" JSONB,
    "optional_steps_json" JSONB,
    "auto_approve_threshold" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "manual_review_threshold" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "webhook_url" TEXT,
    "webhook_secret" TEXT,
    "allowed_specialties_json" JSONB,

    CONSTRAINT "tenant_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_slug_key" ON "document_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_configs_user_id_key" ON "tenant_configs"("user_id");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_steps" ADD CONSTRAINT "verification_steps_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template_fields" ADD CONSTRAINT "document_template_fields_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_configs" ADD CONSTRAINT "tenant_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
