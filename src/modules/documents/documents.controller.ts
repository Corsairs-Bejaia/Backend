import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpStatus,
} from '@nestjs/common';
import { ParseCuidPipe } from '@core/pipes/parse-cuid.pipe';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
import {
  UploadDocumentDto,
  ALLOWED_DOC_TYPES,
} from './dto/upload-document.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';

const MAX_BULK_FILES = 10;

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

  // ── Bulk upload (up to 10 files, one verification) ────────────────────────

  @Post('upload-bulk')
  @ApiOperation({
    summary: 'Upload up to 10 documents in a single request',
    description:
      'Accepts multiple files under the `files` field and a matching `docTypes` ' +
      'array (one entry per file, e.g. `docTypes[0]=diploma&docTypes[1]=national_id`). ' +
      'All files must belong to the same `verificationId`.\n\n' +
      'Each file is processed independently — failures are collected in `errors` and ' +
      'do not abort the batch. Returns `{ uploaded: [...], errors: [...] }`.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files', 'verificationId', 'docTypes'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `Up to ${MAX_BULK_FILES} files (JPEG / PNG / PDF, max 20 MB each)`,
        },
        verificationId: {
          type: 'string',
          description: 'CUID of the target verification',
          example: 'clx9vrf00002',
        },
        docTypes: {
          type: 'array',
          items: { type: 'string', enum: [...ALLOWED_DOC_TYPES] },
          description: 'One docType per file, in the same order as `files`',
          example: ['diploma', 'national_id'],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Batch result — uploaded documents and any per-file errors',
    schema: {
      example: ENVELOPE({
        uploaded: [{ document: DOC_EXAMPLE, presignedUrl: 'https://...' }],
        errors: [
          { index: 1, filename: 'bad.txt', error: 'Unsupported file type' },
        ],
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Verification does not belong to this tenant',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Verification not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No files provided or too many files',
  })
  @UseInterceptors(
    FilesInterceptor('files', MAX_BULK_FILES, {
      limits: { fileSize: 20 * 1024 * 1024 },
      storage: undefined,
    }),
  )
  uploadBulk(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('verificationId') verificationId: string,
    @Body('docTypes') rawDocTypes: string | string[],
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    const docTypes = Array.isArray(rawDocTypes)
      ? rawDocTypes
      : rawDocTypes
        ? [rawDocTypes]
        : [];
    return this.documentsService.uploadBulk(
      files,
      verificationId,
      docTypes,
      user.tenantId,
    );
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
    @Param('verificationId', ParseCuidPipe) verificationId: string,
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
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.documentsService.getPresignedUrl(id, user.tenantId);
  }
}
