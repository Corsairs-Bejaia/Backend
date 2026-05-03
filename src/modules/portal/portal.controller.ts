import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { Public } from '@core/decorators/public.decorator';
import { SessionTokenGuard } from '@core/guards/session-token.guard';
import { SessionVerification } from '@core/decorators/session-verification.decorator';
import type { SessionContext } from '@core/guards/session-token.guard';
import { ALLOWED_DOC_TYPES } from '@modules/documents/dto/upload-document.dto';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { PortalService } from './portal.service';

// ── Minimal upload DTO (verificationId comes from the session) ────────────────

class PortalUploadDto {
  @ApiProperty({ enum: ALLOWED_DOC_TYPES })
  @IsString()
  @IsIn(ALLOWED_DOC_TYPES)
  docType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

@Public() // all portal routes bypass JwtAuthGuard
@ApiTags('Portal')
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  // ── GET /portal/session/:token ────────────────────────────────────────────

  @Get('session/:token')
  @ApiOperation({
    summary: 'Fetch portal session',
    description:
      'Returns the verification status, doctor info, and uploaded documents ' +
      'for the given session token. When the pipeline has `status: completed` ' +
      'and a `redirectUrl` was provided, `signedRedirectUrl` is populated — ' +
      'the portal frontend should redirect the doctor there immediately.',
  })
  @ApiParam({
    name: 'token',
    description: '64-char hex session token from the portal URL',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Session data' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Session not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Session expired',
  })
  getSession(@Param('token') token: string) {
    return this.portalService.getSession(token);
  }

  // ── POST /portal/documents/upload ─────────────────────────────────────────

  @Post('documents/upload')
  @UseGuards(SessionTokenGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
      storage: undefined, // memory storage
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a document from the portal',
    description:
      'Uploads a document (JPEG / PNG / PDF, max 20 MB) and attaches it to the ' +
      'verification bound to the session. Authenticate with `X-Session-Token`.',
  })
  @ApiHeader({
    name: 'X-Session-Token',
    description: '64-char hex session token',
    required: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'docType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        docType: { type: 'string', enum: [...ALLOWED_DOC_TYPES] },
        templateId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Document uploaded' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired session',
  })
  uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: PortalUploadDto,
    @SessionVerification() session: SessionContext,
  ) {
    return this.portalService.uploadDocument(
      session.verificationId,
      session.tenantId,
      file,
      dto,
    );
  }

  // ── POST /portal/submit ───────────────────────────────────────────────────

  @Post('submit')
  @UseGuards(SessionTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit the verification for processing',
    description:
      'Enqueues the verification pipeline. Call this once the doctor has ' +
      'finished uploading all required documents. Returns 409 if already submitted.',
  })
  @ApiHeader({
    name: 'X-Session-Token',
    description: '64-char hex session token',
    required: true,
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pipeline enqueued' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired session',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Verification already submitted',
  })
  submit(@SessionVerification() session: SessionContext) {
    return this.portalService.submit(session.verificationId, session.tenantId);
  }

  // ── GET /portal/stream/:token ─────────────────────────────────────────────

  @Get('stream/:token')
  @ApiOperation({
    summary: 'SSE progress stream for the portal',
    description:
      'Opens a Server-Sent Events connection that emits pipeline progress events. ' +
      'The session token is validated on connection. Suitable for use with the ' +
      'browser `EventSource` API (which cannot set custom headers).',
  })
  @ApiParam({ name: 'token', description: '64-char hex session token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'text/event-stream — JSON progress events',
  })
  async stream(@Param('token') token: string, @Res() res: Response) {
    // Validate token before opening the stream
    const verificationId =
      await this.portalService.getVerificationIdFromToken(token);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const unsubscribe = this.portalService.subscribeToVerification(
      verificationId,
      (message) => {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
      },
    );

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25_000);

    res.on('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
    });
  }
}
