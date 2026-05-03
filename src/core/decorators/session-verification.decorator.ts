import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { SessionContext } from '@core/guards/session-token.guard';

export const SessionVerification = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionContext => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.sessionVerification!;
  },
);
