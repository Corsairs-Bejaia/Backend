import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';

const DOC_EXAMPLE = {
  id: 'clx9doc00001',
  verificationId: 'clx9vrf00002',
  docType: 'diploma',
  storagePath: 'clx9usr00001/clx9vrf00002/diploma.pdf',
  templateId: null,
  mimeType: 'application/pdf',
  uploadedAt: '2026-05-01T09:54:00.000Z',
};

const ENVELOPE = (data: unknown) => ({ success: true, data });

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ── Upload a single document ──────────────────────────────────────────────

  @Post('upload')
  @ApiOperation({
    summary: 'Upload a document file (JPEG, PNG, PDF — max 20 MB)',
    description:
      'Uploads a document to object storage and creates a `Document` record linked ' +
      'to the specified verification. Accepted MIME types: `image/jpeg`, `image/png`, ' +
      '`application/pdf`. Maximum file size: **20 MB**.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'docType', 'verificationId'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The document file (JPEG / PNG / PDF, max 20 MB)',
        },
        docType: {
          type: 'string',
          enum: [
            'national_id',
            'diploma',
            'affiliation',
            'agreement',
            'chifa',
            'ordonnance',
            'other',
          ],
          example: 'diploma',
        },
        verificationId: {
          type: 'string',
          description: 'CUID of the verification this document belongs to',
          example: 'clx9vrf00002',
        },
        templateId: {
          type: 'string',
          description: 'Optional template to use for AI field extraction',
          example: 'clx9tpl00003',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Document uploaded and record created',
    schema: { example: ENVELOPE(DOC_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing required fields or file too large',
    schema: {
      example: {
        statusCode: 400,
        message: 'File size exceeds the 20 MB limit',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Verification does not belong to this tenant',
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

  // ── List documents for a verification ────────────────────────────────────

  @Get('verification/:verificationId')
  @ApiOperation({
    summary: 'List all documents belonging to a verification',
    description:
      'Returns all documents uploaded for the given verification. ' +
      'Returns 403 if the verification does not belong to the authenticated tenant.',
  })
  @ApiParam({
    name: 'verificationId',
    description: 'UUID of the parent verification',
    example: 'clx9vrf00002',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Array of documents',
    schema: { example: ENVELOPE([DOC_EXAMPLE]) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Verification does not belong to this tenant',
  })
  findByVerification(
    @Param('verificationId', ParseUUIDPipe) verificationId: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.documentsService.findByVerification(
      verificationId,
      user.tenantId,
    );
  }

  // ── Fresh presigned URL ───────────────────────────────────────────────────

  @Get(':id/url')
  @ApiOperation({
    summary: 'Get a fresh presigned download URL for a document',
    description:
      'Generates a short-lived (1 hour) pre-signed S3/R2 URL that allows the ' +
      'client to download the document file directly from object storage without ' +
      'proxying through the API.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the document',
    example: 'clx9doc00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Presigned download URL (valid for 1 hour)',
    schema: {
      example: ENVELOPE({
        url: 'https://r2.cloudflarestorage.com/bucket/path/diploma.pdf?X-Amz-Signature=...',
        expiresIn: 3600,
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Document not found or does not belong to this tenant',
    schema: {
      example: {
        statusCode: 404,
        message: 'Document not found',
        error: 'Not Found',
      },
    },
  })
  getPresignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.documentsService.getPresignedUrl(id, user.tenantId);
  }
}
