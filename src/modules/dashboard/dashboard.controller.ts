import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '@core/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ─── Main stats card data ─────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({
    summary:
      'Aggregate stats: doctors, verifications, API keys, recent activity',
  })
  getStats(@CurrentUser() user: { id: string; tenantId: string }) {
    return this.dashboardService.getStats(user.tenantId);
  }

  // ─── Activity feed ────────────────────────────────────────────────────────

  @Get('activity')
  @ApiOperation({
    summary: 'Paginated audit log / activity feed for the tenant',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getActivity(
    @CurrentUser() user: { id: string; tenantId: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.dashboardService.getActivity(user.tenantId, page, limit);
  }

  // ─── Chart: daily verification counts (last 30 days) ─────────────────────

  @Get('chart')
  @ApiOperation({
    summary: 'Daily verification counts (last 30 days) for the activity chart',
  })
  getChartData(@CurrentUser() user: { id: string; tenantId: string }) {
    return this.dashboardService.getChartData(user.tenantId);
  }
}
