import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '@core/decorators/current-user.decorator';

const ENVELOPE = (data: unknown) => ({ success: true, data });

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ── Aggregate stats ───────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({
    summary: 'Aggregate stats for the tenant dashboard',
    description:
      'Returns high-level counts used to populate the dashboard stat cards: ' +
      'total doctors, total verifications (by status), active API keys, and a ' +
      'short recent-activity excerpt.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Aggregated stats',
    schema: {
      example: ENVELOPE({
        doctors: { total: 128, active: 120, inactive: 6, suspended: 2 },
        verifications: {
          total: 340,
          pending: 3,
          running: 1,
          completed: 310,
          failed: 26,
        },
        apiKeys: { total: 4, active: 3 },
        recentActivity: [
          {
            id: 'clx9log00001',
            verificationId: 'clx9vrf00001',
            action: 'verification_completed',
            actor: 'clx9usr00001',
            createdAt: '2026-05-01T09:56:00.000Z',
          },
        ],
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  getStats(@CurrentUser() user: { id: string; tenantId: string }) {
    return this.dashboardService.getStats(user.tenantId);
  }

  // ── Activity feed ─────────────────────────────────────────────────────────

  @Get('activity')
  @ApiOperation({
    summary: 'Paginated audit log / activity feed for the tenant',
    description:
      'Returns `AuditLog` entries for the current tenant ordered by ' +
      '`createdAt` descending. Each entry records a significant system event ' +
      '(verification completed, human review, document uploaded, etc.).',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (1-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Items per page',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated audit log entries',
    schema: {
      example: ENVELOPE({
        items: [
          {
            id: 'clx9log00001',
            verificationId: 'clx9vrf00001',
            action: 'verification_completed',
            actor: 'clx9usr00001',
            detailsJson: { score: 0.92, decision: 'approved' },
            createdAt: '2026-05-01T09:56:00.000Z',
          },
          {
            id: 'clx9log00002',
            verificationId: 'clx9vrf00002',
            action: 'human_review_completed',
            actor: 'clx9usr00001',
            detailsJson: { decision: 'approved', note: 'All documents valid.' },
            createdAt: '2026-05-01T11:30:00.000Z',
          },
        ],
        total: 148,
        page: 1,
        limit: 20,
        totalPages: 8,
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  getActivity(
    @CurrentUser() user: { id: string; tenantId: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.dashboardService.getActivity(user.tenantId, page, limit);
  }

  // ── Chart data ────────────────────────────────────────────────────────────

  @Get('chart')
  @ApiOperation({
    summary: 'Daily verification counts for the last 30 days (chart data)',
    description:
      'Returns one data point per calendar day for the last 30 days. ' +
      'Each point includes counts broken down by outcome. ' +
      'Intended for the dashboard line/bar chart.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Array of daily data points',
    schema: {
      example: ENVELOPE([
        {
          date: '2026-04-02',
          total: 4,
          approved: 3,
          manual_review: 1,
          rejected: 0,
        },
        {
          date: '2026-04-03',
          total: 7,
          approved: 6,
          manual_review: 0,
          rejected: 1,
        },
        {
          date: '2026-05-01',
          total: 12,
          approved: 10,
          manual_review: 1,
          rejected: 1,
        },
      ]),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  getChartData(@CurrentUser() user: { id: string; tenantId: string }) {
    return this.dashboardService.getChartData(user.tenantId);
  }
}
