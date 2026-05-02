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
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { VerificationsService } from './verifications.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';
import { CacheService } from '@shared/cache/cache.service';
import { Public } from '@core/decorators/public.decorator';

@ApiTags('Verifications')
@ApiBearerAuth()
@Controller('verifications')
export class VerificationsController {
  constructor(
    private readonly verificationsService: VerificationsService,
    private readonly cache: CacheService,
  ) {}

  // ─── Create + enqueue ─────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Start a new verification workflow for a doctor' })
  create(
    @Body() dto: CreateVerificationDto,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.verificationsService.create(dto, user.tenantId);
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List verifications for the current tenant' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: { id: string; tenantId: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.verificationsService.findAll(user.tenantId, page, limit);
  }

  // ─── Get one ──────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a verification by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.verificationsService.findOne(id, user.tenantId);
  }

  // ─── SSE progress stream ──────────────────────────────────────────────────
  //
  // Accessible without a dashboard JWT — doctor opens this URL directly.
  // The verificationId itself acts as the access token (it is a CUID, not
  // guessable, and was handed to the doctor by the tenant).
  //
  // Usage: GET /api/verifications/:id/stream
  //        Accept: text/event-stream

  @Get(':id/stream')
  @Public()
  @ApiOperation({ summary: 'SSE stream of progress events for a verification' })
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
