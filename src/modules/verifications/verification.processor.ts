import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@shared/prisma/prisma.service';
import { CacheService } from '@shared/cache/cache.service';
import { ReportsService } from '@modules/reports/reports.service';
import { WebhooksService } from '@modules/webhooks/webhooks.service';
import {
  WebhookEventType,
  type VerificationCompletedPayload,
  type VerificationFailedPayload,
} from '@modules/webhooks/event-types';
import { Prisma } from '@prisma/client';
import { AiClientService } from '@modules/ai-client/ai-client.service';
import {
  VERIFICATION_QUEUE,
  VERIFY_DOCTOR_JOB,
} from './verifications.constants';

// ─── Job payload ─────────────────────────────────────────────────────────────

interface VerifyDoctorPayload {
  verificationId: string;
  tenantId: string;
}

// ─── SSE event helper ─────────────────────────────────────────────────────────

type EventType =
  | 'started'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'completed'
  | 'failed';

interface ProgressEvent {
  type: EventType;
  verificationId: string;
  step?: string;
  data?: unknown;
  timestamp: string;
}

// ─── Processor ───────────────────────────────────────────────────────────────

@Processor(VERIFICATION_QUEUE)
export class VerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(VerificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly reportsService: ReportsService,
    private readonly webhooks: WebhooksService,
    private readonly aiClient: AiClientService,
  ) {
    super();
  }

  override async process(job: Job<VerifyDoctorPayload>): Promise<void> {
    if (job.name !== VERIFY_DOCTOR_JOB) return;

    const { verificationId, tenantId } = job.data;
    const channel = `verification:${verificationId}`;

    const emit = async (
      event: Omit<ProgressEvent, 'verificationId' | 'timestamp'>,
    ) => {
      const payload: ProgressEvent = {
        ...event,
        verificationId,
        timestamp: new Date().toISOString(),
      };
      await this.cache.publish(channel, JSON.stringify(payload));
    };

    try {
      // ── Mark verification as running ───────────────────────────────────────
      await this.prisma.verification.update({
        where: { id: verificationId },
        data: { status: 'running' },
      });
      await emit({ type: 'started' });

      // ── Load documents attached to this verification ───────────────────────
      const documents = await this.prisma.document.findMany({
        where: { verificationId },
      });

      // ── STEP 1: AI Pipeline ───────────────────────────────────────────────
      // Runs all 7 agents: Classifier → OCR/Extraction → Authenticity →
      // Consistency → CNAS Scraping → Scoring → Report
      const step1 = await this.prisma.verificationStep.create({
        data: {
          verificationId,
          stepType: 'ai_pipeline',
          status: 'running',
          startedAt: new Date(),
        },
      });
      await emit({ type: 'step_started', step: 'ai_pipeline' });

      const aiResponse = await this.aiClient.runPipeline(verificationId);
      const scoring = aiResponse.results['scoring'];
      const authenticity = aiResponse.results['authenticity'];
      const reportMd = (
        aiResponse.results['report'] as { report_md?: string } | undefined
      )?.report_md;

      await this.prisma.verificationStep.update({
        where: { id: step1.id },
        data: {
          status: 'completed',
          resultJson: aiResponse.results as unknown as Prisma.InputJsonValue,
          confidence: scoring
            ? (scoring as { score: number }).score / 100
            : null,
          completedAt: new Date(),
        },
      });
      await emit({
        type: 'step_completed',
        step: 'ai_pipeline',
        data: aiResponse.results,
      });

      // ── Map AI output to backend domain ───────────────────────────────────
      // AI score is 0-100; DB stores 0-1.
      // AI decision 'review' maps to backend 'manual_review'.
      const rawDecision = scoring
        ? (scoring as { decision: string }).decision
        : 'rejected';
      const score = scoring ? (scoring as { score: number }).score / 100 : 0;
      const decision =
        rawDecision === 'approved'
          ? 'approved'
          : rawDecision === 'review'
            ? 'manual_review'
            : 'rejected';
      const completedAt = new Date();

      // ── Update per-document authenticity scores ────────────────────────────
      // Capture the score before the transaction; the in-memory `documents`
      // array will not reflect DB updates, so we use this variable when
      // building the webhook payload below.
      let docAuthScore: number | null = null;
      if (authenticity && documents.length > 0) {
        docAuthScore =
          (authenticity as { authenticity_score: number }).authenticity_score /
          100;
        await this.prisma.$transaction(
          documents.map((d) =>
            this.prisma.document.update({
              where: { id: d.id },
              data: { authenticityScore: docAuthScore },
            }),
          ),
        );
      }

      await this.prisma.verification.update({
        where: { id: verificationId },
        data: { status: 'completed', score, decision, completedAt },
      });

      await this.prisma.auditLog.create({
        data: {
          verificationId,
          action: 'verification_completed',
          actor: tenantId,
          detailsJson: { score, decision },
        },
      });

      // ── Create report (always, AI-generated when available) ───────────────
      const reportContent =
        reportMd ??
        this.buildFallbackReport({
          verificationId,
          score,
          decision,
          documentCount: documents.length,
        });
      await this.reportsService.createForVerification(
        verificationId,
        reportContent,
        'markdown',
        tenantId,
        score,
        decision,
      );
      this.logger.log(
        `Report created for verification ${verificationId} (${decision})`,
      );

      // ── Fire verification.completed webhook ───────────────────────────────
      const [allSteps, verificationWithDoctor] = await Promise.all([
        this.prisma.verificationStep.findMany({
          where: { verificationId },
          orderBy: { startedAt: 'asc' },
        }),
        this.prisma.verification.findUnique({
          where: { id: verificationId },
          include: { doctor: true },
        }),
      ]);

      const webhookPayload: VerificationCompletedPayload = {
        verificationId,
        tenantId,
        doctor: {
          id: verificationWithDoctor!.doctor.id,
          fullNameFr: verificationWithDoctor!.doctor.fullNameFr,
          fullNameAr: verificationWithDoctor!.doctor.fullNameAr ?? null,
          nationalIdNumber: verificationWithDoctor!.doctor.nationalIdNumber,
        },
        score,
        decision,
        completedAt: completedAt.toISOString(),
        steps: allSteps.map((s) => ({
          stepType: s.stepType,
          status: s.status,
          confidence: s.confidence ?? null,
        })),
        documents: documents.map((d) => ({
          id: d.id,
          docType: d.docType,
          // Use the freshly computed score — the in-memory `d.authenticityScore`
          // is stale (loaded before the transaction above).
          authenticityScore: docAuthScore ?? d.authenticityScore ?? null,
        })),
      };

      this.webhooks.send(
        tenantId,
        WebhookEventType.VERIFICATION_COMPLETED,
        webhookPayload,
        `verification.completed.${verificationId}`,
      );

      await emit({ type: 'completed', data: { score, decision } });
      this.logger.log(
        `Verification ${verificationId} → ${decision} (score: ${score})`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Verification ${verificationId} failed: ${message}`);

      await this.prisma.verification.update({
        where: { id: verificationId },
        data: { status: 'failed' },
      });

      await this.cache.publish(
        `verification:${verificationId}`,
        JSON.stringify({
          type: 'failed',
          verificationId,
          data: { message },
          timestamp: new Date().toISOString(),
        }),
      );

      // ── Fire verification.failed webhook ──────────────────────────────────
      const failedPayload: VerificationFailedPayload = {
        verificationId,
        tenantId,
        error: message,
        failedAt: new Date().toISOString(),
      };
      this.webhooks.send(
        tenantId,
        WebhookEventType.VERIFICATION_FAILED,
        failedPayload,
        `verification.failed.${verificationId}`,
      );

      throw err; // let BullMQ handle retries
    }
  }

  // ─── Stub report builder ──────────────────────────────────────────────────
  // TODO: remove once AiClientService.generateReport() is wired in.

  private buildFallbackReport(ctx: {
    verificationId: string;
    score: number;
    decision: string;
    documentCount: number;
  }): string {
    const scorePercent = Math.round(ctx.score * 100);
    const decisionLabel =
      ctx.decision === 'manual_review' ? 'Révision manuelle requise' : 'Rejeté';

    return [
      `# Rapport de vérification`,
      ``,
      `**Identifiant** : \`${ctx.verificationId}\`  `,
      `**Score** : ${scorePercent} / 100  `,
      `**Décision** : ${decisionLabel}  `,
      `**Documents analysés** : ${ctx.documentCount}  `,
      ``,
      `## Résumé`,
      ``,
      `Ce rapport a été généré automatiquement à l'issue du pipeline de vérification.`,
      `Un examinateur humain doit valider ou rejeter ce dossier.`,
      ``,
      `## Étapes du pipeline`,
      ``,
      `| Étape | Statut | Confiance |`,
      `|-------|--------|-----------|`,
      `| Extraction IA | Complété | ${scorePercent}% |`,
      `| Vérification CNAS | Ignoré (service non configuré) | — |`,
      ``,
      `## Action requise`,
      ``,
      ctx.decision === 'manual_review'
        ? `Le score (${scorePercent}%) est dans la plage de révision manuelle (60–85). Veuillez examiner les documents et soumettre une décision.`
        : `Le score (${scorePercent}%) est inférieur au seuil de révision (60). Veuillez examiner les documents avant de confirmer le rejet.`,
    ].join('\n');
  }
}
