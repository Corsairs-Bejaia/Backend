import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-internal-api-key'] as string | undefined;
    const expected = this.config.get<string>('services.internalApiKey');

    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
