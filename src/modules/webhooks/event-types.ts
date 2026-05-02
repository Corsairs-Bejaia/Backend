// ─── Event type string constants ─────────────────────────────────────────────

export const WebhookEventType = {
  VERIFICATION_COMPLETED: 'verification.completed',
  VERIFICATION_FAILED: 'verification.failed',
  REPORT_CREATED: 'report.created',
  REPORT_REVIEWED: 'report.reviewed',
} as const;

export type WebhookEventType =
  (typeof WebhookEventType)[keyof typeof WebhookEventType];

// ─── Payload shapes ───────────────────────────────────────────────────────────

export interface VerificationCompletedPayload {
  verificationId: string;
  tenantId: string;
  doctor: {
    id: string;
    fullNameFr: string;
    fullNameAr: string | null;
    nationalIdNumber: string;
  };
  score: number;
  /** 'approved' | 'rejected' | 'manual_review' */
  decision: string;
  completedAt: string;
  steps: Array<{
    stepType: string;
    status: string;
    confidence: number | null;
  }>;
  documents: Array<{
    id: string;
    docType: string;
    authenticityScore: number | null;
  }>;
}

export interface VerificationFailedPayload {
  verificationId: string;
  tenantId: string;
  error: string;
  failedAt: string;
}

export interface ReportCreatedPayload {
  reportId: string;
  verificationId: string;
  tenantId: string;
  /** The verification decision that triggered the report */
  verificationDecision: string;
  score: number;
  createdAt: string;
}

export interface ReportReviewedPayload {
  reportId: string;
  verificationId: string;
  tenantId: string;
  /** 'human_approved' | 'human_rejected' */
  decision: string;
  decisionNote: string | null;
  reviewedAt: string;
}
