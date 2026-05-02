import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const ALLOWED_DOC_TYPES = [
  'national_id',
  'diploma',
  'affiliation',
  'agreement',
  'chifa',
  'ordonnance',
  'other',
] as const;

export class UploadDocumentDto {
  @ApiProperty({ enum: ALLOWED_DOC_TYPES })
  @IsString()
  @IsIn(ALLOWED_DOC_TYPES)
  docType!: string;

  @ApiProperty({
    description: 'ID of the verification this document belongs to',
  })
  @IsString()
  verificationId!: string;

  @ApiPropertyOptional({
    description: 'Template ID to use for extraction (auto-detected if omitted)',
  })
  @IsOptional()
  @IsString()
  templateId?: string;
}
