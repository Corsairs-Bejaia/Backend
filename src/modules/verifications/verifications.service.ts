import { randomBytes } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/prisma/prisma.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import {
  VERIFICATION_QUEUE,
  VERIFY_DOCTOR_JOB,
} from './verifications.constants';

@Injectable()
export class VerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(VERIFICATION_QUEUE) private readonly queue: Queue,
  ) {}

  // ─── Create a new verification session ───────────────────────────────────
  // Returns a portal URL the tenant redirects the doctor to.
  // The pipeline is NOT enqueued here — it starts when the doctor submits
  // their documents on the portal (POST /portal/submit).

  async create(dto: CreateVerificationDto, tenantId: string) {
    // ── Resolve doctor ─────────────────────────────────────────────────────
    let doctorId: string;

    if (dto.doctor) {
      // Find-or-create by (tenantId, nationalIdNumber). The @@unique constraint
      // on those two columns makes the upsert safe against races.
      const doctor = await this.prisma.doctor.upsert({
        where: {
          tenantId_nationalIdNumber: {
            tenantId,
            nationalIdNumber: dto.doctor.nationalIdNumber,
          },
        },
        create: {
          tenantId,
          fullNameFr: dto.doctor.fullNameFr,
          fullNameAr: dto.doctor.fullNameAr,
          nationalIdNumber: dto.doctor.nationalIdNumber,
        },
        update: {
          fullNameFr: dto.doctor.fullNameFr,
          fullNameAr: dto.doctor.fullNameAr,
        },
      });
      doctorId = doctor.id;
    } else if (dto.doctorId) {
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: dto.doctorId },
      });
      if (!doctor) throw new NotFoundException('Doctor not found');
      if (doctor.tenantId !== tenantId) throw new ForbiddenException();
      doctorId = doctor.id;
    } else {
      throw new BadRequestException(
        'Either doctorId or doctor must be provided',
      );
    }

    // ── Generate session token ─────────────────────────────────────────────
    const sessionToken = randomBytes(32).toString('hex');
    const ttlHours = this.config.get<number>('app.portalSessionTtlHours') ?? 1;
    const sessionExpiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1_000);

    // ── Persist verification ───────────────────────────────────────────────
    const verification = await this.prisma.verification.create({
      data: {
        doctorId,
        tenantId,
        workflowConfigJson: (dto.workflowConfig ?? {}) as Prisma.InputJsonValue,
        status: 'pending',
        sessionToken,
        sessionExpiresAt,
        redirectUrl: dto.redirectUrl,
      },
    });

    const portalBaseUrl =
      this.config.get<string>('app.portalBaseUrl') ?? 'http://localhost:3001';

    return {
      id: verification.id,
      doctorId: verification.doctorId,
      tenantId: verification.tenantId,
      status: verification.status,
      startedAt: verification.startedAt,
      redirectUrl: verification.redirectUrl ?? null,
      portalUrl: `${portalBaseUrl}/verify/${sessionToken}`,
      expiresAt: sessionExpiresAt.toISOString(),
    };
  }

  // ─── Enqueue the pipeline job (called by PortalService on submit) ─────────

  async enqueueVerification(verificationId: string, tenantId: string) {
    await this.queue.add(
      VERIFY_DOCTOR_JOB,
      { verificationId, tenantId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
    );
  }

  // ─── Find one ─────────────────────────────────────────────────────────────

  async findOne(id: string, tenantId: string) {
    const verification = await this.prisma.verification.findUnique({
      where: { id },
      include: { steps: true, documents: true },
    });
    if (!verification) throw new NotFoundException('Verification not found');
    if (verification.tenantId !== tenantId) throw new ForbiddenException();
    return verification;
  }

  // ─── List for the tenant ──────────────────────────────────────────────────

  async findAll(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.verification.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: { steps: true },
      }),
      this.prisma.verification.count({ where: { tenantId } }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
