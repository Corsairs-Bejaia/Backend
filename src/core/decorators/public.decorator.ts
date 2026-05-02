import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — skips the global JwtAuthGuard.
 * Use on routes that should be accessible without a JWT token.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
