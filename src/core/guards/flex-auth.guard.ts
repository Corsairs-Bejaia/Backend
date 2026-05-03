import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeyGuard } from './api-key.guard';

/**
 * Accepts either:
 *   - x-api-key header  →  validated via ApiKeyGuard, normalised to req.user
 *   - Authorization: Bearer <token>  →  validated via Passport JWT strategy
 *
 * Apply to controllers that should support both auth surfaces (developer API).
 * Use @ApiBearerAuth() + @ApiSecurity('api-key') on those controllers for Swagger.
 */
@Injectable()
export class FlexAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly apiKeyGuard: ApiKeyGuard) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Record<string, unknown> & {
        headers: Record<string, string>;
        user?: unknown;
        apiKeyUser?: {
          userId: string;
          apiKeyId: string;
          permissions: string[];
        };
      }
    >();

    if (req.headers['x-api-key']) {
      const ok = await this.apiKeyGuard.canActivate(context);
      if (ok && req.apiKeyUser) {
        // Normalise apiKeyUser → req.user so @CurrentUser() is consistent
        req.user = {
          sub: req.apiKeyUser.userId,
          id: req.apiKeyUser.userId,
          userId: req.apiKeyUser.userId,
          tenantId: req.apiKeyUser.userId,
          apiKeyId: req.apiKeyUser.apiKeyId,
          permissions: req.apiKeyUser.permissions,
          authMethod: 'api-key' as const,
        };
      }
      return ok;
    }

    // No API key header → enforce JWT (Passport sets req.user)
    return super.canActivate(context) as Promise<boolean>;
  }
}
