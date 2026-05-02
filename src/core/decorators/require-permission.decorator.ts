import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declare required permission(s) on a route.
 * Used together with the ApiKeyGuard which checks the key's permissions array.
 *
 * @example @RequirePermission('verifications:write')
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
