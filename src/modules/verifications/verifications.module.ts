import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VerificationsService } from './verifications.service';
import { VerificationsController } from './verifications.controller';
import { VerificationProcessor } from './verification.processor';
import { VERIFICATION_QUEUE } from './verifications.constants';
import { ReportsModule } from '@modules/reports/reports.module';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';
import { AiClientModule } from '@modules/ai-client/ai-client.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: VERIFICATION_QUEUE }),
    ReportsModule,
    WebhooksModule,
    AiClientModule,
  ],
  controllers: [VerificationsController],
  providers: [VerificationsService, VerificationProcessor],
  exports: [VerificationsService],
})
export class VerificationsModule {}
