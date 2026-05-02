import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiry: process.env.JWT_EXPIRY ?? '15m',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
}));
