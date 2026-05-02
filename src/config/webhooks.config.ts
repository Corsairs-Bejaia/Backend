import { registerAs } from '@nestjs/config';

export default registerAs('webhooks', () => ({
  svixApiKey: process.env.SVIX_API_KEY,
}));
