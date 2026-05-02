import { createHmac, randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure random string.
 * @param bytes Number of random bytes (output is hex, so length = bytes * 2)
 */
export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Compute HMAC-SHA256 signature for webhook delivery.
 * Clients can verify the signature to confirm the payload is from us.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}
