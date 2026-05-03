import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '@shared/prisma/prisma.service';
import { StorageService } from '@shared/storage/storage.service';
import type {
  AiPipelineDoc,
  AiPipelineResponse,
  AiTemplate,
  AiTemplateField,
} from './ai-client.types';

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Run the full AI agentic pipeline for a verification.
   *
   * Loads documents + templates from the DB, generates presigned URLs,
   * and calls POST /pipeline on the AI service.
   */
  async runPipeline(verificationId: string): Promise<AiPipelineResponse> {
    // ── 1. Load verification + documents (with linked templates + fields) ──
    const verification = await this.prisma.verification.findUniqueOrThrow({
      where: { id: verificationId },
      select: {
        workflowConfigJson: true,
        documents: {
          select: {
            id: true,
            docType: true,
            filePath: true,
            template: {
              select: {
                slug: true,
                name: true,
                docType: true,
                fields: {
                  select: {
                    fieldName: true,
                    fieldType: true,
                    isRequired: true,
                    fieldLabelFr: true,
                    validationRegex: true,
                    positionHintJson: true,
                  },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    const { documents } = verification;
    const workflowConfig =
      (verification.workflowConfigJson as Record<string, unknown> | null) ?? {};

    // ── 2. Generate presigned download URLs in parallel ────────────────────
    const presignedUrls = await Promise.all(
      documents.map((d) => this.storage.getPresignedUrl(d.filePath, 3_600)),
    );

    // ── 3. Build document list ─────────────────────────────────────────────
    const aiDocs: AiPipelineDoc[] = documents.map((d, i) => ({
      file_url: presignedUrls[i],
      doc_type_hint: d.docType,
    }));

    // ── 4. Build deduplicated templates list from linked templates ─────────
    //       layer is metadata only in our context — the AI service uses its
    //       own internal DOC_TYPE_TO_LAYER map for scoring.
    const templateMap = new Map<string, AiTemplate>();
    for (const doc of documents) {
      if (!doc.template) continue;
      const t = doc.template;
      if (templateMap.has(t.slug)) continue;

      const fields: AiTemplateField[] = t.fields.map((f) => {
        const field: AiTemplateField = {
          field_name: f.fieldName,
          field_type: f.fieldType,
          is_required: f.isRequired,
          description: f.fieldLabelFr,
        };
        if (f.validationRegex) field.validation_regex = f.validationRegex;
        if (f.positionHintJson)
          field.position_hint = f.positionHintJson as Record<string, number>;
        return field;
      });

      templateMap.set(t.slug, {
        slug: t.slug,
        doc_type: t.docType,
        name: t.name,
        layer: 'L1',
        fields,
      });
    }

    // ── 5. Resolve required_docs + trust_threshold from workflowConfig ─────
    const requiredDocs = Array.isArray(workflowConfig['required_docs'])
      ? (workflowConfig['required_docs'] as string[])
      : documents.map((d) => d.docType);

    const trustThreshold =
      typeof workflowConfig['trust_threshold'] === 'number'
        ? workflowConfig['trust_threshold']
        : 80.0;

    // ── 6. Call AI service ─────────────────────────────────────────────────
    const aiServiceUrl = this.config.get<string>('services.aiServiceUrl')!;
    const internalApiKey =
      this.config.get<string>('services.internalApiKey') ?? '';

    if (!internalApiKey) {
      this.logger.warn(
        'INTERNAL_API_KEY is not set — AI service will reject with 401',
      );
    }

    this.logger.log(
      `Calling AI pipeline for verification ${verificationId} ` +
        `(${documents.length} document(s))`,
    );

    const { data } = await firstValueFrom(
      this.http.post<AiPipelineResponse>(
        `${aiServiceUrl}/api/pipeline`,
        {
          documents: aiDocs,
          templates: Array.from(templateMap.values()),
          required_docs: requiredDocs,
          trust_threshold: trustThreshold,
          stream: false,
        },
        {
          headers: { 'x-internal-api-key': internalApiKey },
          // AI pipeline can take several minutes (browser scraping + multiple LLM calls)
          timeout: 5 * 60 * 1_000,
        },
      ),
    );

    return data;
  }
}
