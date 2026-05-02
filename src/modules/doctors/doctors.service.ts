import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(dto: CreateDoctorDto, tenantId: string) {
    // Prevent duplicate NIN within the same tenant
    const existing = await this.prisma.doctor.findFirst({
      where: { nationalIdNumber: dto.nationalIdNumber, tenantId },
    });
    if (existing) {
      throw new ConflictException(
        'A doctor with this national ID number already exists',
      );
    }

    return this.prisma.doctor.create({
      data: {
        tenantId,
        fullNameFr: dto.fullNameFr,
        fullNameAr: dto.fullNameAr ?? null,
        nationalIdNumber: dto.nationalIdNumber,
      },
    });
  }

  // ─── List (tenant-scoped, paginated) ──────────────────────────────────────

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    status?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              {
                fullNameFr: { contains: search, mode: 'insensitive' as const },
              },
              {
                fullNameAr: { contains: search, mode: 'insensitive' as const },
              },
              { nationalIdNumber: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { verifications: true } },
        },
      }),
      this.prisma.doctor.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Find one ─────────────────────────────────────────────────────────────

  async findOne(id: string, tenantId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        verifications: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            score: true,
            decision: true,
            startedAt: true,
            completedAt: true,
          },
        },
        _count: { select: { verifications: true } },
      },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (doctor.tenantId !== tenantId) throw new ForbiddenException();
    return doctor;
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateDoctorDto, tenantId: string) {
    await this.findOne(id, tenantId); // ownership check

    // NIN uniqueness check if being changed
    if (dto.nationalIdNumber) {
      const conflict = await this.prisma.doctor.findFirst({
        where: {
          nationalIdNumber: dto.nationalIdNumber,
          tenantId,
          NOT: { id },
        },
      });
      if (conflict) {
        throw new ConflictException(
          'A doctor with this national ID number already exists',
        );
      }
    }

    return this.prisma.doctor.update({
      where: { id },
      data: {
        ...(dto.fullNameFr !== undefined ? { fullNameFr: dto.fullNameFr } : {}),
        ...(dto.fullNameAr !== undefined ? { fullNameAr: dto.fullNameAr } : {}),
        ...(dto.nationalIdNumber !== undefined
          ? { nationalIdNumber: dto.nationalIdNumber }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId); // ownership check
    await this.prisma.doctor.delete({ where: { id } });
    return { deleted: true };
  }
}
