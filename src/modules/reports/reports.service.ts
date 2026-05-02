import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/prisma/prisma.service';
import { AddCommentDto } from './dto/add-comment.dto';
import { ReviewDecision, SubmitDecisionDto } from './dto/submit-decision.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Review queue ────────────────────────────────────────────────────────

  async findAll(tenantId: string, page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;

    const where = {
      verification: { tenantId },
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.verificationReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          verification: {
            select: {
              id: true,
              score: true,
              decision: true,
              startedAt: true,
              doctor: {
                select: {
                  fullNameFr: true,
                  fullNameAr: true,
                  nationalIdNumber: true,
                },
              },
            },
          },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.verificationReport.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Single report ───────────────────────────────────────────────────────

  async findOne(id: string, tenantId: string) {
    const report = await this.prisma.verificationReport.findFirst({
      where: { id, verification: { tenantId } },
      include: {
        verification: {
          include: {
            doctor: true,
            steps: { orderBy: { startedAt: 'asc' } },
            documents: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, email: true, companyName: true } },
          },
        },
        reviewer: { select: { id: true, email: true, companyName: true } },
      },
    });

    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  // ─── Find report by verification ID ─────────────────────────────────────

  async findByVerification(verificationId: string, tenantId: string) {
    const report = await this.prisma.verificationReport.findFirst({
      where: { verificationId, verification: { tenantId } },
      include: {
        verification: {
          include: {
            doctor: true,
            steps: { orderBy: { startedAt: 'asc' } },
            documents: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, email: true, companyName: true } },
          },
        },
        reviewer: { select: { id: true, email: true, companyName: true } },
      },
    });

    if (!report)
      throw new NotFoundException('No report found for this verification');
    return report;
  }

  // ─── Submit review decision ──────────────────────────────────────────────

  async submitDecision(
    id: string,
    tenantId: string,
    reviewerId: string,
    dto: SubmitDecisionDto,
  ) {
    const report = await this.prisma.verificationReport.findFirst({
      where: { id, verification: { tenantId } },
    });

    if (!report) throw new NotFoundException('Report not found');

    if (report.status !== 'pending_review') {
      throw new BadRequestException(
        `Report has already been reviewed (status: ${report.status})`,
      );
    }

    // Map review decision to verification status/decision
    const verificationUpdates: { status: string; decision: string } = {
      status: 'completed',
      decision:
        dto.decision === ReviewDecision.APPROVED
          ? 'human_approved'
          : dto.decision === ReviewDecision.REJECTED
            ? 'human_rejected'
            : 'resubmit_requested',
    };

    // If resubmit, set verification back to pending so a new job can be started
    if (dto.decision === ReviewDecision.RESUBMIT) {
      verificationUpdates.status = 'pending';
    }

    const updatedReport = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updated = await tx.verificationReport.update({
          where: { id },
          data: {
            status: 'reviewed',
            decision: dto.decision,
            decisionNote: dto.decisionNote,
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
          },
        });
        await tx.verification.update({
          where: { id: report.verificationId },
          data: verificationUpdates,
        });
        await tx.auditLog.create({
          data: {
            verificationId: report.verificationId,
            action: 'human_review_completed',
            actor: reviewerId,
            detailsJson: {
              decision: dto.decision,
              note: dto.decisionNote ?? null,
            },
          },
        });
        return updated;
      },
    );

    return updatedReport;
  }

  // ─── Add comment ─────────────────────────────────────────────────────────

  async addComment(
    id: string,
    tenantId: string,
    authorId: string,
    dto: AddCommentDto,
  ) {
    // Ensure report belongs to tenant before allowing comment
    const report = await this.prisma.verificationReport.findFirst({
      where: { id, verification: { tenantId } },
      select: { id: true, status: true },
    });

    if (!report) throw new NotFoundException('Report not found');

    if (report.status === 'reviewed') {
      throw new ForbiddenException(
        'Cannot add comments to an already reviewed report',
      );
    }

    return this.prisma.reviewComment.create({
      data: { reportId: id, authorId, content: dto.content },
      include: {
        author: { select: { id: true, email: true, companyName: true } },
      },
    });
  }

  // ─── Internal: create report after verification pipeline ─────────────────
  // Called by VerificationProcessor — not exposed via HTTP.

  createForVerification(
    verificationId: string,
    content: string,
    format: 'markdown' | 'json' = 'markdown',
  ) {
    return this.prisma.verificationReport.create({
      data: {
        verificationId,
        contentRaw: content,
        contentFormat: format,
        status: 'pending_review',
      },
    });
  }
}
