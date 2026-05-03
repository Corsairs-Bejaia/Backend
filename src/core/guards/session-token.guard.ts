import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '@shared/prisma/prisma.service';

export interface SessionContext {
  verificationId: string;
  tenantId: string;
}

declare module 'express' {
  interface Request {
    sessionVerification?: SessionContext;
  }
}

@Injectable()
export class SessionTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.headers['x-session-token'];
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Missing X-Session-Token header');
    }

    const verification = await this.prisma.verification.findUnique({
      where: { sessionToken: token },
      select: {
        id: true,
        tenantId: true,
        sessionExpiresAt: true,
        status: true,
      },
    });

    if (!verification) {
      throw new UnauthorizedException('Invalid session token');
    }

    if (
      verification.sessionExpiresAt &&
      verification.sessionExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Session token has expired');
    }

    req.sessionVerification = {
      verificationId: verification.id,
      tenantId: verification.tenantId,
    };

    return true;
  }
}
