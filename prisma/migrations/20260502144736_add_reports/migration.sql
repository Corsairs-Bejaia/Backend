-- CreateTable
CREATE TABLE "verification_reports" (
    "id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "content_format" TEXT NOT NULL DEFAULT 'markdown',
    "content_raw" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "decision" TEXT,
    "decision_note" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_reports_verification_id_key" ON "verification_reports"("verification_id");

-- AddForeignKey
ALTER TABLE "verification_reports" ADD CONSTRAINT "verification_reports_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_reports" ADD CONSTRAINT "verification_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "verification_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
