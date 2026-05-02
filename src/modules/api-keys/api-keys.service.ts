import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import { hashApiKey } from '@core/utils/hash.util';
import { generateSecret } from '@core/utils/crypto.util';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateApiKeyDto) {
    // Format: sk_live_{32 hex chars}
    // keyPrefix = 'sk_live_' + first 8 chars of random part (16 chars total)
    // This gives enough uniqueness for a single DB lookup before bcrypt compare
    const randomPart = generateSecret(16); // 32 hex chars
    const rawKey = `sk_live_${randomPart}`;
    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = await hashApiKey(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyHash,
        keyPrefix,
        permissions: dto.permissions ?? [
          'verifications:read',
          'verifications:write',
        ],
        rateLimit: dto.rateLimit ?? 100,
      },
    });

    // Return the raw key exactly once — it cannot be recovered after this response
    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix,
      permissions: apiKey.permissions,
      createdAt: apiKey.createdAt,
    };
  }

  findAll(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.userId !== userId) throw new ForbiddenException();

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });
  }
}
