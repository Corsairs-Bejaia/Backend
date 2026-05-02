import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@shared/prisma/prisma.service';
import {
  CreateTemplateDto,
  CreateTemplateFieldDto,
} from './dto/create-template.dto';
import {
  UpdateTemplateDto,
  UpdateTemplateFieldDto,
} from './dto/update-template.dto';
import { SaveFieldPositionsDto } from './dto/save-field-positions.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List ─────────────────────────────────────────────────────────────────

  findAll(tenantId: string) {
    return this.prisma.documentTemplate.findMany({
      where: {
        OR: [{ isSystem: true }, { tenantId }],
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
  }

  // ─── Single ───────────────────────────────────────────────────────────────

  async findOne(id: string, tenantId: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Template not found');
    if (!template.isSystem && template.tenantId !== tenantId) {
      throw new ForbiddenException();
    }
    return template;
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateTemplateDto) {
    return this.prisma.documentTemplate.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        docType: dto.docType,
        description: dto.description,
        isSystem: false,
        fields: dto.fields
          ? { create: dto.fields.map((f, i) => this.mapField(f, i)) }
          : undefined,
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(id: string, tenantId: string, dto: UpdateTemplateDto) {
    const template = await this.findOne(id, tenantId);
    if (template.isSystem)
      throw new ForbiddenException('System templates cannot be modified');

    return this.prisma.documentTemplate.update({
      where: { id },
      data: dto,
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, tenantId: string) {
    const template = await this.findOne(id, tenantId);
    if (template.isSystem)
      throw new ForbiddenException('System templates cannot be deleted');

    await this.prisma.documentTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── Fields ───────────────────────────────────────────────────────────────

  async addField(
    templateId: string,
    tenantId: string,
    dto: CreateTemplateFieldDto,
  ) {
    await this.findOne(templateId, tenantId); // access check
    const count = await this.prisma.documentTemplateField.count({
      where: { templateId },
    });
    return this.prisma.documentTemplateField.create({
      data: { templateId, ...this.mapField(dto, count) },
    });
  }

  async updateField(
    templateId: string,
    fieldId: string,
    tenantId: string,
    dto: UpdateTemplateFieldDto,
  ) {
    const template = await this.findOne(templateId, tenantId);
    if (template.isSystem)
      throw new ForbiddenException('System template fields cannot be modified');

    return this.prisma.documentTemplateField.update({
      where: { id: fieldId },
      data: dto,
    });
  }

  async removeField(templateId: string, fieldId: string, tenantId: string) {
    const template = await this.findOne(templateId, tenantId);
    if (template.isSystem)
      throw new ForbiddenException('System template fields cannot be deleted');

    await this.prisma.documentTemplateField.delete({ where: { id: fieldId } });
  }

  // ─── Field positions (visual mapper) ──────────────────────────────────────

  async saveFieldPositions(
    id: string,
    tenantId: string,
    dto: SaveFieldPositionsDto,
  ) {
    // For system templates, tenants save positions as their own override copy —
    // here we simply persist to fieldPositionsJson on the template itself (tenant access checked)
    await this.findOne(id, tenantId);
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { fieldPositionsJson: dto.positions },
    });
  }

  // ─── Sample image ─────────────────────────────────────────────────────────

  async saveSampleImageUrl(id: string, tenantId: string, url: string) {
    await this.findOne(id, tenantId);
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { sampleImageUrl: url },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private mapField(f: CreateTemplateFieldDto, defaultOrder: number) {
    return {
      fieldName: f.fieldName,
      fieldLabelFr: f.fieldLabelFr,
      fieldLabelAr: f.fieldLabelAr,
      fieldType: f.fieldType,
      isRequired: f.isRequired ?? true,
      validationRegex: f.validationRegex,
      sortOrder: f.sortOrder ?? defaultOrder,
    };
  }
}
