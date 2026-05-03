import { Module } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { SessionTokenGuard } from '@core/guards/session-token.guard';
import { DocumentsModule } from '@modules/documents/documents.module';
import { VerificationsModule } from '@modules/verifications/verifications.module';

@Module({
  imports: [DocumentsModule, VerificationsModule],
  controllers: [PortalController],
  providers: [PortalService, SessionTokenGuard],
})
export class PortalModule {}
