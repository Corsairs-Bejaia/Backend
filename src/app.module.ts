import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';

// Config
import appConfig from '@config/app.config';
import databaseConfig from '@config/database.config';
import redisConfig from '@config/redis.config';
import jwtConfig from '@config/jwt.config';
import storageConfig from '@config/storage.config';
import servicesConfig from '@config/services.config';
import webhooksConfig from '@config/webhooks.config';

// Shared
import { SharedModule } from '@shared/shared.module';

// Feature modules
import { AuthModule } from '@modules/auth/auth.module';
import { ApiKeysModule } from '@modules/api-keys/api-keys.module';
import { UsersModule } from '@modules/users/users.module';
import { TemplatesModule } from '@modules/templates/templates.module';
import { DocumentsModule } from '@modules/documents/documents.module';
import { VerificationsModule } from '@modules/verifications/verifications.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { DoctorsModule } from '@modules/doctors/doctors.module';
import { ReportsModule } from '@modules/reports/reports.module';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';
import { PortalModule } from '@modules/portal/portal.module';

// Core
import { JwtAuthGuard } from '@core/guards/jwt-auth.guard';
import { HttpExceptionFilter } from '@core/filters/http-exception.filter';
import { PrismaExceptionFilter } from '@core/filters/prisma-exception.filter';
import { ResponseTransformInterceptor } from '@core/interceptors/response-transform.interceptor';
import { LoggingInterceptor } from '@core/interceptors/logging.interceptor';

@Module({
  imports: [
    // ── Environment ────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        storageConfig,
        servicesConfig,
        webhooksConfig,
      ],
    }),

    // ── Queue (BullMQ + Redis Cloud) ───────────────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('redis.url'),
        },
      }),
    }),

    // ── Rate limiting ──────────────────────────────────────────────────────
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    // ── Shared infra (Prisma, Storage, Cache) ─────────────────────────────
    SharedModule,

    // ── Feature modules ────────────────────────────────────────────────────
    AuthModule,
    ApiKeysModule,
    UsersModule,
    TemplatesModule,
    DocumentsModule,
    VerificationsModule,
    DashboardModule,
    DoctorsModule,
    ReportsModule,
    WebhooksModule,
    PortalModule,
    // AiClientModule,
    // ScrapingClientModule,
  ],
  providers: [
    // Global JWT guard — all routes protected by default.
    // Mark public routes with @Public() decorator.
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // Global exception filters (registration order = reverse execution order)
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },

    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
