import { registerAs } from '@nestjs/config';

export default registerAs('services', () => ({
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8001',
  scrapingServiceUrl:
    process.env.SCRAPING_SERVICE_URL ?? 'http://localhost:8002',
  internalApiKey: process.env.INTERNAL_API_KEY,
}));
