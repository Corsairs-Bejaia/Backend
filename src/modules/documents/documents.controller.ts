import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ─── Upload a single document ─────────────────────────────────────────────

  @Post('upload')
  @ApiOperation({
    summary: 'Upload a document file (JPEG, PNG, PDF — max 20 MB)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        docType: { type: 'string' },
        verificationId: { type: 'string' },
        templateId: { type: 'string' },
      },
      required: ['file', 'docType', 'verificationId'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
      storage: undefined, // use memory storage (buffer available)
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.documentsService.upload(file, dto, user.tenantId);
  }

  // ─── List documents for a verification ───────────────────────────────────

  @Get('verification/:verificationId')
  @ApiOperation({ summary: 'List all documents belonging to a verification' })
  findByVerification(
    @Param('verificationId', ParseUUIDPipe) verificationId: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.documentsService.findByVerification(
      verificationId,
      user.tenantId,
    );
  }

  // ─── Fresh presigned URL ──────────────────────────────────────────────────

  @Get(':id/url')
  @ApiOperation({
    summary: 'Get a fresh presigned download URL for a document',
  })
  getPresignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.documentsService.getPresignedUrl(id, user.tenantId);
  }
}
