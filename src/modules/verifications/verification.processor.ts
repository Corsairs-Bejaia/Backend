import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@shared/prisma/prisma.service';
import { CacheService } from '@shared/cache/cache.service';
import { ReportsService } from '@modules/reports/reports.service';
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

      // ── STEP 1: AI Document Extraction ────────────────────────────────────
      //
      // TODO: replace stub with AiClientService.runPipeline() when available
      // Expected call:
      //   const aiResult = await this.aiClient.runPipeline({ verificationId, documents });
      //
      const step1 = await this.prisma.verificationStep.create({
        data: {
          verificationId,
          stepType: 'ai_extraction',
          status: 'running',
          startedAt: new Date(),
        },
      });
      await emit({ type: 'step_started', step: 'ai_extraction' });

      // Stub: accept all documents as extracted with full confidence
      const aiResult = {
        extracted: documents.map((d) => ({
          documentId: d.id,
          docType: d.docType,
        })),
        confidence: 0.95,
      };

      await this.prisma.verificationStep.update({
        where: { id: step1.id },
        data: {
          status: 'completed',
          resultJson: aiResult,
          confidence: 0.95,
          completedAt: new Date(),
        },
      });
      await emit({
        type: 'step_completed',
        step: 'ai_extraction',
        data: aiResult,
      });

      // ── STEP 2: CNAS Affiliation Check ─────────────────────────────────────
      //
      // TODO: replace stub with ScrapingClientService.verifyCnas() when available
      // Expected call:
      //   const cnasResult = await this.scrapingClient.verifyCnas({ nationalId, employerNumber });
      //
      const step2 = await this.prisma.verificationStep.create({
        data: {
          verificationId,
          stepType: 'cnas_check',
          status: 'running',
          startedAt: new Date(),
        },
      });
      await emit({ type: 'step_started', step: 'cnas_check' });

      // Stub: mark as skipped (no scraping service yet)
      const cnasResult = {
        status: 'skipped',
        reason: 'scraping_service_not_configured',
      };

      await this.prisma.verificationStep.update({
        where: { id: step2.id },
        data: {
          status: 'completed',
          resultJson: cnasResult,
          completedAt: new Date(),
        },
      });
      await emit({
        type: 'step_completed',
        step: 'cnas_check',
        data: cnasResult,
      });

      // ── Compute overall score + decision ───────────────────────────────────
      const score = aiResult.confidence;
      const decision =
        score >= 0.8 ? 'approved' : score >= 0.5 ? 'manual_review' : 'rejected';

      await this.prisma.verification.update({
        where: { id: verificationId },
        data: { status: 'completed', score, decision, completedAt: new Date() },
      });

      await this.prisma.auditLog.create({
        data: {
          verificationId,
          action: 'verification_completed',
          actor: tenantId,
          detailsJson: { score, decision },
        },
      });

      // ── Auto-create report for decisions requiring human review ────────────
      if (decision === 'manual_review' || decision === 'rejected') {
        // TODO: replace stub content with AiClientService.generateReport() output
        // when available. The AI service will produce a structured markdown/JSON
        // summary including field-level extraction results, confidence breakdown,
        // and discrepancies found.
        const reportContent = this.buildStubReport({
          verificationId,
          score,
          decision,
          documentCount: documents.length,
        });
        await this.reportsService.createForVerification(
          verificationId,
          reportContent,
          'markdown',
        );
        this.logger.log(
          `Report created for verification ${verificationId} (${decision})`,
        );
      }

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

      throw err; // let BullMQ handle retries
    }
  }

  // ─── Stub report builder ──────────────────────────────────────────────────
  // TODO: remove once AiClientService.generateReport() is wired in.

  private buildStubReport(ctx: {
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
