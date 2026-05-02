import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import {
  CreateTemplateDto,
  CreateTemplateFieldDto,
} from './dto/create-template.dto';
import {
  UpdateTemplateDto,
  UpdateTemplateFieldDto,
} from './dto/update-template.dto';
import { SaveFieldPositionsDto } from './dto/save-field-positions.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';
import { StorageService } from '@shared/storage/storage.service';

const FIELD_EXAMPLE = {
  id: 'clx9fld00001',
  templateId: 'clx9tpl00001',
  fieldName: 'full_name_fr',
  fieldLabelFr: 'Nom complet (FR)',
  fieldLabelAr: 'الاسم الكامل',
  fieldType: 'name_fr',
  isRequired: true,
  validationRegex: null,
  sortOrder: 0,
};

const TEMPLATE_EXAMPLE = {
  id: 'clx9tpl00001',
  userId: 'clx9usr00001',
  name: 'University Diploma',
  slug: 'university-diploma',
  docType: 'diploma',
  description: 'Standard Algerian university diploma template',
  sampleImageUrl: null,
  createdAt: '2026-01-20T10:00:00.000Z',
  updatedAt: '2026-01-20T10:00:00.000Z',
  fields: [FIELD_EXAMPLE],
};

const ENVELOPE = (data: unknown) => ({ success: true, data });

// Templates are accessible via both JWT (dashboard) and API key (client integration)
// The JWT guard is global; ApiKeyGuard is added as an alternative where needed.
// For simplicity all template endpoints require JWT (dashboard only).
@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly storageService: StorageService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List all document templates for this tenant',
    description:
      'Returns all templates created by the authenticated tenant, each with ' +
      'its full list of extraction fields.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Array of templates with fields',
    schema: { example: ENVELOPE([TEMPLATE_EXAMPLE]) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  findAll(@CurrentUser() user: { userId: string }) {
    return this.templatesService.findAll(user.userId);
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get a template by ID (includes fields and field positions)',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the template',
    example: 'clx9tpl00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template with fields and visual positions',
    schema: { example: ENVELOPE(TEMPLATE_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template not found or does not belong to this tenant',
    schema: {
      example: {
        statusCode: 404,
        message: 'Template not found',
        error: 'Not Found',
      },
    },
  })
  findOne(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.templatesService.findOne(id, user.userId);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Create a new document template',
    description:
      'Creates a template that defines which fields to extract from a specific ' +
      'document type. Fields can be included in the request body or added later ' +
      'via `POST /templates/:id/fields`.',
  })
  @ApiBody({ type: CreateTemplateDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Template created',
    schema: { example: ENVELOPE(TEMPLATE_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    schema: {
      example: {
        statusCode: 400,
        message: ['name must be longer than or equal to 2 characters'],
        error: 'Bad Request',
      },
    },
  })
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templatesService.create(user.userId, dto);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  @Put(':id')
  @ApiOperation({
    summary: 'Update template metadata',
    description:
      'Partial update — only fields present in the request body are changed.',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the template',
    example: 'clx9tpl00001',
  })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated template',
    schema: { example: ENVELOPE({ ...TEMPLATE_EXAMPLE, name: 'Diploma v2' }) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template not found',
  })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, user.userId, dto);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a template and all its fields',
    description:
      'Hard-deletes the template and all associated field definitions.',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the template',
    example: 'clx9tpl00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template deleted',
    schema: { example: ENVELOPE(TEMPLATE_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template not found',
  })
  remove(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.templatesService.remove(id, user.userId);
  }

  // ── Fields ────────────────────────────────────────────────────────────────

  @Post(':id/fields')
  @ApiOperation({
    summary: 'Add a field to a template',
    description: "Appends a new extraction field to the template's field list.",
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the parent template',
    example: 'clx9tpl00001',
  })
  @ApiBody({ type: CreateTemplateFieldDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Field added',
    schema: { example: ENVELOPE(FIELD_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template not found',
  })
  addField(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateTemplateFieldDto,
  ) {
    return this.templatesService.addField(id, user.userId, dto);
  }

  @Put(':id/fields/:fieldId')
  @ApiOperation({ summary: 'Update an existing template field' })
  @ApiParam({
    name: 'id',
    description: 'CUID of the parent template',
    example: 'clx9tpl00001',
  })
  @ApiParam({
    name: 'fieldId',
    description: 'CUID of the field',
    example: 'clx9fld00001',
  })
  @ApiBody({ type: UpdateTemplateFieldDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated field',
    schema: {
      example: ENVELOPE({ ...FIELD_EXAMPLE, fieldLabelFr: 'Prénom et nom' }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template or field not found',
  })
  updateField(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateTemplateFieldDto,
  ) {
    return this.templatesService.updateField(id, fieldId, user.userId, dto);
  }

  @Delete(':id/fields/:fieldId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a field from a template' })
  @ApiParam({
    name: 'id',
    description: 'CUID of the parent template',
    example: 'clx9tpl00001',
  })
  @ApiParam({
    name: 'fieldId',
    description: 'CUID of the field',
    example: 'clx9fld00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Field removed',
    schema: { example: ENVELOPE(FIELD_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template or field not found',
  })
  removeField(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.templatesService.removeField(id, fieldId, user.userId);
  }

  // ── Visual field positions ────────────────────────────────────────────────

  @Post(':id/field-positions')
  @ApiOperation({
    summary: 'Save visual field bounding boxes on the sample image',
    description:
      'Stores the relative coordinates `{ x, y, width, height }` (values 0.0–1.0) ' +
      'for each field name. These positions are used by the AI service to locate ' +
      'fields on scanned documents.',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the template',
    example: 'clx9tpl00001',
  })
  @ApiBody({ type: SaveFieldPositionsDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Positions saved — returns updated template with field positions',
    schema: {
      example: ENVELOPE({
        ...TEMPLATE_EXAMPLE,
        fieldPositions: {
          full_name_fr: { x: 0.1, y: 0.15, width: 0.6, height: 0.05 },
        },
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template not found',
  })
  saveFieldPositions(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveFieldPositionsDto,
  ) {
    return this.templatesService.saveFieldPositions(id, user.userId, dto);
  }

  // ── Sample image upload ───────────────────────────────────────────────────

  @Post(':id/sample-image')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a sample document image for the template',
    description:
      'Uploads a representative scan/photo of the document type. The image is ' +
      'stored in object storage and the presigned URL is saved on the template. ' +
      'Use the visual editor in the dashboard to draw field bounding boxes on this image.',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the template',
    example: 'clx9tpl00001',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPEG / PNG sample image',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Image uploaded — returns updated template with sampleImageUrl',
    schema: {
      example: ENVELOPE({
        ...TEMPLATE_EXAMPLE,
        sampleImageUrl:
          'https://r2.cloudflarestorage.com/bucket/templates/clx9tpl00001/sample.jpg?...',
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Template not found',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSampleImage(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    const ext = file.originalname.split('.').pop();
    const path = `templates/${id}/sample.${ext}`;
    await this.storageService.uploadFile(file.buffer, path, file.mimetype);
    const url = await this.storageService.getPresignedUrl(path, 86400 * 365);
    return this.templatesService.saveSampleImageUrl(id, user.userId, url);
  }
}
