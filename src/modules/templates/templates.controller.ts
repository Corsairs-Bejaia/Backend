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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
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

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.templatesService.findAll(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.templatesService.findOne(id, user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templatesService.create(user.userId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, user.userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.templatesService.remove(id, user.userId);
  }

  // ── Fields ────────────────────────────────────────────────────────────────

  @Post(':id/fields')
  addField(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateTemplateFieldDto,
  ) {
    return this.templatesService.addField(id, user.userId, dto);
  }

  @Put(':id/fields/:fieldId')
  updateField(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateTemplateFieldDto,
  ) {
    return this.templatesService.updateField(id, fieldId, user.userId, dto);
  }

  @Delete(':id/fields/:fieldId')
  removeField(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.templatesService.removeField(id, fieldId, user.userId);
  }

  // ── Visual field positions ────────────────────────────────────────────────

  @Post(':id/field-positions')
  saveFieldPositions(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveFieldPositionsDto,
  ) {
    return this.templatesService.saveFieldPositions(id, user.userId, dto);
  }

  // ── Sample image upload ───────────────────────────────────────────────────

  @ApiConsumes('multipart/form-data')
  @Post(':id/sample-image')
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
