import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '@shared/prisma/prisma.service';
import { PERMISSIONS_KEY } from '@core/decorators/require-permission.decorator';
import * as bcrypt from 'bcrypt';

interface ApiKeyRequest extends Request {
  apiKeyUser: {
    apiKeyId: string;
    userId: string;
    permissions: string[];
  };
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const rawKey = request.headers['x-api-key'] as string | undefined;

    if (!rawKey) throw new UnauthorizedException('API key required');

    // Prefix is first 16 chars (sk_live_ + 8 random hex) — matches keyPrefix
    // stored at creation time. Avoids a full table scan before bcrypt compare.
    const prefix = rawKey.slice(0, 16);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyPrefix: prefix, isActive: true },
    });

    if (!apiKey) throw new UnauthorizedException('Invalid API key');

    const valid = await bcrypt.compare(rawKey, apiKey.keyHash);
    if (!valid) throw new UnauthorizedException('Invalid API key');

    // Update last used timestamp (fire and forget)
    this.prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => null);

    // Check permissions declared via @RequirePermission()
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (required?.length) {
      const hasAll = required.every((p) => apiKey.permissions.includes(p));
      if (!hasAll)
        throw new ForbiddenException('Insufficient API key permissions');
    }

    // Attach api key info to request for downstream use
    request.apiKeyUser = {
      apiKeyId: apiKey.id,
      userId: apiKey.userId,
      permissions: apiKey.permissions,
    };

    return true;
  }
}
