import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Res,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { VerificationsService } from './verifications.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';
import { CacheService } from '@shared/cache/cache.service';
import { Public } from '@core/decorators/public.decorator';

const VERIFICATION_EXAMPLE = {
  id: 'clx9vrf00001',
  doctorId: 'clx9doc00002',
  tenantId: 'clx9usr00001',
  status: 'pending',
  score: null,
  decision: null,
  startedAt: '2026-05-01T09:55:00.000Z',
  completedAt: null,
};

const VERIFICATION_COMPLETED_EXAMPLE = {
  ...VERIFICATION_EXAMPLE,
  status: 'completed',
  score: 0.92,
  decision: 'approved',
  completedAt: '2026-05-01T09:56:00.000Z',
};

const SSE_EVENT_EXAMPLES = [
  {
    type: 'started',
    verificationId: 'clx9vrf00001',
    timestamp: '2026-05-01T09:55:00.100Z',
  },
  {
    type: 'step_started',
    verificationId: 'clx9vrf00001',
    step: 'ai_extraction',
    timestamp: '2026-05-01T09:55:00.500Z',
  },
  {
    type: 'step_completed',
    verificationId: 'clx9vrf00001',
    step: 'ai_extraction',
    data: { confidence: 0.92 },
    timestamp: '2026-05-01T09:55:07.000Z',
  },
  {
    type: 'completed',
    verificationId: 'clx9vrf00001',
    data: { score: 0.92, decision: 'approved' },
    timestamp: '2026-05-01T09:55:08.000Z',
  },
];

const ENVELOPE = (data: unknown) => ({ success: true, data });

@ApiTags('Verifications')
@ApiBearerAuth()
@Controller('verifications')
export class VerificationsController {
  constructor(
    private readonly verificationsService: VerificationsService,
    private readonly cache: CacheService,
  ) {}

  // ── Create + enqueue ──────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Start a new verification workflow for a doctor',
    description:
      'Creates a `Verification` record, enqueues a BullMQ job, and immediately ' +
      'returns the new record (status: `pending`). The pipeline runs asynchronously; ' +
      'subscribe to `GET /verifications/:id/stream` (SSE) to watch progress in real time.\n\n' +
      '**Pipeline stages:**\n' +
      '1. AI document extraction (confidence score)\n' +
      '2. CNAS affiliation check\n' +
      '3. Score → decision mapping:\n' +
      '   - ≥ 80 % → `approved`\n' +
      '   - 50–79 % → `manual_review` (report auto-created)\n' +
      '   - < 50 % → `rejected` (report auto-created)',
  })
  @ApiBody({ type: CreateVerificationDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Verification created and job enqueued',
    schema: { example: ENVELOPE(VERIFICATION_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Doctor does not belong to this tenant',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Doctor not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Doctor not found',
        error: 'Not Found',
      },
    },
  })
  create(
    @Body() dto: CreateVerificationDto,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.verificationsService.create(dto, user.tenantId);
  }

  // ── List ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List verifications for the current tenant',
    description: 'Returns a paginated list ordered by `startedAt` descending.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated verification list',
    schema: {
      example: ENVELOPE({
        items: [VERIFICATION_COMPLETED_EXAMPLE],
        total: 58,
        page: 1,
        limit: 20,
        totalPages: 3,
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  findAll(
    @CurrentUser() user: { id: string; tenantId: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.verificationsService.findAll(user.tenantId, page, limit);
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get a verification by ID',
    description:
      'Returns the verification with its pipeline steps and documents.',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the verification',
    example: 'clx9vrf00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification detail with steps and documents',
    schema: {
      example: ENVELOPE({
        ...VERIFICATION_COMPLETED_EXAMPLE,
        steps: [
          {
            id: 'clx9stp00003',
            stepType: 'ai_extraction',
            status: 'completed',
            confidence: 0.92,
            startedAt: '2026-05-01T09:55:00.500Z',
            completedAt: '2026-05-01T09:55:07.000Z',
          },
        ],
        documents: [
          {
            id: 'clx9doc00004',
            docType: 'diploma',
            storagePath: 'tenant/verif/diploma.pdf',
          },
        ],
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Verification does not belong to this tenant',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Verification not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Verification not found',
        error: 'Not Found',
      },
    },
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.verificationsService.findOne(id, user.tenantId);
  }

  // ── SSE progress stream ───────────────────────────────────────────────────

  @Get(':id/stream')
  @Public()
  @ApiOperation({
    summary: 'SSE stream of real-time progress events for a verification',
    description:
      'Opens a Server-Sent Events connection that emits progress events as the ' +
      'verification pipeline executes.\n\n' +
      '**Authentication:** This endpoint is **public** — no Bearer token required. ' +
      'The CUID in the URL acts as an unguessable access token.\n\n' +
      '**Usage:**\n' +
      '```\n' +
      'GET /api/verifications/:id/stream\n' +
      'Accept: text/event-stream\n' +
      '```\n\n' +
      '**Event types:** `started` | `step_started` | `step_completed` | `step_failed` | `completed` | `failed`\n\n' +
      '**Keep-alive:** a `: heartbeat` comment is sent every 25 s to prevent proxy timeouts.',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the verification to stream',
    example: 'clx9vrf00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'text/event-stream — sequence of JSON event objects',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example: SSE_EVENT_EXAMPLES.map(
            (e) => `data: ${JSON.stringify(e)}`,
          ).join('\n\n'),
        },
      },
    },
  })
  stream(@Param('id') id: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    const channel = `verification:${id}`;

    const unsubscribe = this.cache.subscribe(channel, (message) => {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    });

    // Keep-alive every 25 s so proxies don't close the connection
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25_000);

    res.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  }
}
