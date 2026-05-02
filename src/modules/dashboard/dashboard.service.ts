import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Aggregate stats for the tenant ──────────────────────────────────────

  async getStats(tenantId: string) {
    const [
      totalDoctors,
      totalVerifications,
      verificationsByStatus,
      recentVerifications,
      activeApiKeys,
      thisMonthVerifications,
      lastMonthVerifications,
    ] = await Promise.all([
      // Total doctors registered under this tenant
      this.prisma.doctor.count({ where: { tenantId } }),

      // Total verifications ever
      this.prisma.verification.count({ where: { tenantId } }),

      // Count per status
      this.prisma.verification.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),

      // Last 5 completed verifications
      this.prisma.verification.findMany({
        where: { tenantId, status: { in: ['completed', 'failed'] } },
        orderBy: { completedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          score: true,
          decision: true,
          startedAt: true,
          completedAt: true,
          doctor: {
            select: { id: true, fullNameFr: true, fullNameAr: true },
          },
        },
      }),

      // Active API keys count
      this.prisma.apiKey.count({ where: { userId: tenantId, isActive: true } }),

      // This calendar month
      this.prisma.verification.count({
        where: {
          tenantId,
          startedAt: { gte: startOfMonth(new Date()) },
        },
      }),

      // Last calendar month (for delta calculation)
      this.prisma.verification.count({
        where: {
          tenantId,
          startedAt: {
            gte: startOfMonth(subMonths(new Date(), 1)),
            lt: startOfMonth(new Date()),
          },
        },
      }),
    ]);

    // Flatten status counts into a keyed object
    const statusCounts: Record<string, number> = {};
    for (const row of verificationsByStatus) {
      statusCounts[row.status] = row._count._all;
    }

    // Month-over-month delta
    const momDelta =
      lastMonthVerifications === 0
        ? null
        : Math.round(
            ((thisMonthVerifications - lastMonthVerifications) /
              lastMonthVerifications) *
              100,
          );

    return {
      doctors: {
        total: totalDoctors,
      },
      verifications: {
        total: totalVerifications,
        thisMonth: thisMonthVerifications,
        lastMonth: lastMonthVerifications,
        momDeltaPercent: momDelta,
        byStatus: statusCounts,
      },
      apiKeys: {
        active: activeApiKeys,
      },
      recentVerifications,
    };
  }

  // ─── Activity feed (audit log) ────────────────────────────────────────────

  async getActivity(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { verification: { tenantId } },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          actor: true,
          detailsJson: true,
          timestamp: true,
          verificationId: true,
        },
      }),
      this.prisma.auditLog.count({
        where: { verification: { tenantId } },
      }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Daily verification counts (last 30 days) — for chart ─────────────────

  async getChartData(tenantId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; total: bigint; approved: bigint; rejected: bigint }>
    >`
      SELECT
        DATE_TRUNC('day', started_at)                     AS day,
        COUNT(*)                                           AS total,
        COUNT(*) FILTER (WHERE decision = 'approved')     AS approved,
        COUNT(*) FILTER (WHERE decision = 'rejected')     AS rejected
      FROM verifications
      WHERE tenant_id = ${tenantId}
        AND started_at >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;

    return rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      total: Number(r.total),
      approved: Number(r.approved),
      rejected: Number(r.rejected),
    }));
  }
}

// ─── Local date helpers (avoid pulling in date-fns for two functions) ─────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function subMonths(d: Date, n: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() - n);
  return result;
}
