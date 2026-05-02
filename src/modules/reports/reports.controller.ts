import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { AddCommentDto } from './dto/add-comment.dto';
import { ReviewDecision, SubmitDecisionDto } from './dto/submit-decision.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';

// Shape returned by JwtStrategy.validate() + enriched by the auth guard.
// sub  = User.id = Tenant.id (single-tenant-per-user model)
interface JwtPayload {
  sub: string;
  email: string;
}

// ─── Inline Swagger schema helpers ───────────────────────────────────────────

const REPORT_SUMMARY_EXAMPLE = {
  id: 'clx9abc00001',
  verificationId: 'clx9def00002',
  contentFormat: 'markdown',
  status: 'pending_review',
  decision: null,
  decisionNote: null,
  reviewedBy: null,
  reviewedAt: null,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
  verification: {
    id: 'clx9def00002',
    score: 0.65,
    decision: 'manual_review',
    startedAt: '2026-05-01T09:55:00.000Z',
    doctor: {
      fullNameFr: 'Benali Mohamed',
      fullNameAr: 'بنعلي محمد',
      nationalIdNumber: '198501234567890',
    },
  },
  _count: { comments: 2 },
};

const REPORT_DETAIL_EXAMPLE = {
  ...REPORT_SUMMARY_EXAMPLE,
  contentRaw:
    '# Rapport de vérification\n\n**Score**: 65 / 100\n\n## Résultats pipeline\n...',
  verification: {
    ...REPORT_SUMMARY_EXAMPLE.verification,
    status: 'completed',
    doctor: {
      id: 'clx9doc00003',
      fullNameFr: 'Benali Mohamed',
      fullNameAr: 'بنعلي محمد',
      nationalIdNumber: '198501234567890',
      specialty: 'Cardiologie',
    },
    steps: [
      {
        id: 'clx9stp00004',
        stepType: 'ai_extraction',
        status: 'completed',
        confidence: 0.65,
        startedAt: '2026-05-01T09:55:05.000Z',
        completedAt: '2026-05-01T09:55:12.000Z',
      },
      {
        id: 'clx9stp00005',
        stepType: 'cnas_check',
        status: 'completed',
        confidence: null,
        startedAt: '2026-05-01T09:55:12.000Z',
        completedAt: '2026-05-01T09:55:13.000Z',
      },
    ],
    documents: [
      {
        id: 'clx9doc00006',
        docType: 'diploma',
        storagePath: 'tenant-id/verif-id/diploma.pdf',
        uploadedAt: '2026-05-01T09:54:00.000Z',
      },
    ],
  },
  comments: [
    {
      id: 'clx9cmt00007',
      content: 'Diploma scan is blurry on page 2.',
      createdAt: '2026-05-01T11:00:00.000Z',
      author: {
        id: 'clx9usr00008',
        email: 'reviewer@clinic.dz',
        companyName: 'Clinic Alger',
      },
    },
  ],
  reviewer: null,
};

const ENVELOPE = (data: unknown) => ({ success: true, data });

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // ── Review queue ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List verification reports (review queue)',
    description:
      'Returns a paginated list of `VerificationReport` records scoped to the ' +
      'authenticated tenant. Reports are auto-created by the pipeline whenever ' +
      'the AI decision is `manual_review` or `rejected`. Use `?status=pending_review` ' +
      'to fetch items waiting for a human decision.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (1-based, default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending_review', 'reviewed'],
    description: 'Filter by report status. Omit to return all.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated review queue',
    schema: {
      example: ENVELOPE({
        items: [REPORT_SUMMARY_EXAMPLE],
        total: 14,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.reports.findAll(user.sub, page, limit, status);
  }

  // ── Report by verification ID ─────────────────────────────────────────────
  // NOTE: this route must be declared before `:id` to prevent NestJS from
  // matching the literal string "by-verification" as a report ID.

  @Get('by-verification/:verificationId')
  @ApiOperation({
    summary: 'Get the report for a specific verification',
    description:
      'Convenience lookup — resolves the report from a verification ID rather ' +
      'than the report ID. Returns 404 if no report has been generated yet ' +
      '(i.e. the verification was `approved` by the AI without human review).',
  })
  @ApiParam({
    name: 'verificationId',
    description: 'CUID of the parent verification',
    example: 'clx9def00002',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Full report with verification context, pipeline steps, documents and comments',
    schema: { example: ENVELOPE(REPORT_DETAIL_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No report found for this verification ID',
    schema: {
      example: {
        statusCode: 404,
        message: 'No report found for this verification',
        error: 'Not Found',
      },
    },
  })
  findByVerification(
    @Param('verificationId') verificationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reports.findByVerification(verificationId, user.sub);
  }

  // ── Single report ─────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get a report by ID',
    description:
      'Returns the complete report including the raw AI-generated content, ' +
      'verification context with all pipeline steps and uploaded documents, ' +
      'inline reviewer comments, and reviewer metadata.',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the report',
    example: 'clx9abc00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Full report detail',
    schema: { example: ENVELOPE(REPORT_DETAIL_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Report not found or does not belong to this tenant',
    schema: {
      example: {
        statusCode: 404,
        message: 'Report not found',
        error: 'Not Found',
      },
    },
  })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.reports.findOne(id, user.sub);
  }

  // ── Submit review decision ────────────────────────────────────────────────

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit a human review decision',
    description:
      "Records the reviewer's verdict and updates the parent verification:\n\n" +
      '| decision | verification.decision | verification.status |\n' +
      '|----------|-----------------------|---------------------|\n' +
      '| `approved` | `human_approved` | `completed` |\n' +
      '| `rejected` | `human_rejected` | `completed` |\n' +
      '| `resubmit` | `resubmit_requested` | `pending` |\n\n' +
      'All three paths create an `AuditLog` entry with action `human_review_completed`. ' +
      'Returns **400** if the report has already been reviewed.',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the report to review',
    example: 'clx9abc00001',
  })
  @ApiBody({ type: SubmitDecisionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Decision recorded — returns the updated report',
    schema: {
      example: ENVELOPE({
        ...REPORT_DETAIL_EXAMPLE,
        status: 'reviewed',
        decision: ReviewDecision.APPROVED,
        decisionNote: 'All documents verified successfully.',
        reviewedBy: 'clx9usr00008',
        reviewedAt: '2026-05-02T08:30:00.000Z',
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Report has already been reviewed',
    schema: {
      example: {
        statusCode: 400,
        message: 'Report has already been reviewed (status: reviewed)',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Report not found or does not belong to this tenant',
    schema: {
      example: {
        statusCode: 404,
        message: 'Report not found',
        error: 'Not Found',
      },
    },
  })
  submitDecision(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubmitDecisionDto,
  ) {
    return this.reports.submitDecision(id, user.sub, user.sub, dto);
  }

  // ── Add inline comment ────────────────────────────────────────────────────

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add an inline comment to a report',
    description:
      'Appends a reviewer comment to the report thread. Comments are ordered ' +
      'chronologically and included in the `GET /reports/:id` response. ' +
      'Returns **403** if the report has already been reviewed (status: `reviewed`).',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the report',
    example: 'clx9abc00001',
  })
  @ApiBody({ type: AddCommentDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Comment created',
    schema: {
      example: ENVELOPE({
        id: 'clx9cmt00009',
        reportId: 'clx9abc00001',
        authorId: 'clx9usr00008',
        content:
          'The diploma scan on page 2 is illegible. Please ask the doctor to re-upload.',
        createdAt: '2026-05-02T09:00:00.000Z',
        author: {
          id: 'clx9usr00008',
          email: 'reviewer@clinic.dz',
          companyName: 'Clinic Alger',
        },
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Cannot add comments to an already reviewed report',
    schema: {
      example: {
        statusCode: 403,
        message: 'Cannot add comments to an already reviewed report',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Report not found or does not belong to this tenant',
    schema: {
      example: {
        statusCode: 404,
        message: 'Report not found',
        error: 'Not Found',
      },
    },
  })
  addComment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddCommentDto,
  ) {
    return this.reports.addComment(id, user.sub, user.sub, dto);
  }
}
