import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
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
    @InjectQueue(VERIFICATION_QUEUE) private readonly queue: Queue,
  ) {}

  // ─── Create a new verification and enqueue the job ────────────────────────

  async create(dto: CreateVerificationDto, tenantId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: dto.doctorId },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (doctor.tenantId !== tenantId) throw new ForbiddenException();

    const verification = await this.prisma.verification.create({
      data: {
        doctorId: dto.doctorId,
        tenantId,
        workflowConfigJson: (dto.workflowConfig ?? {}) as Prisma.InputJsonValue,
        status: 'pending',
      },
    });

    await this.queue.add(
      VERIFY_DOCTOR_JOB,
      { verificationId: verification.id, tenantId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return verification;
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
