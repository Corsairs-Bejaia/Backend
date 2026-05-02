import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VerificationsService } from './verifications.service';
import { VerificationsController } from './verifications.controller';
import { VerificationProcessor } from './verification.processor';
import { VERIFICATION_QUEUE } from './verifications.constants';

@Module({
  imports: [BullModule.registerQueue({ name: VERIFICATION_QUEUE })],
  controllers: [VerificationsController],
  providers: [VerificationsService, VerificationProcessor],
  exports: [VerificationsService],
})
export class VerificationsModule {}
