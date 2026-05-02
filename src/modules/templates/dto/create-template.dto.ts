import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateFieldDto {
  @ApiProperty({ example: 'full_name_fr' })
  @IsString()
  fieldName!: string;

  @ApiProperty({ example: 'Nom complet (FR)' })
  @IsString()
  fieldLabelFr!: string;

  @ApiPropertyOptional({ example: 'الاسم الكامل' })
  @IsOptional()
  @IsString()
  fieldLabelAr?: string;

  @ApiProperty({
    example: 'name_fr',
    description:
      'text | number | date | year | boolean | enum | name_ar | name_fr',
  })
  @IsString()
  fieldType!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    example: '^\\d{18}$',
    description: 'Validation regex pattern',
  })
  @IsOptional()
  @IsString()
  validationRegex?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  sortOrder?: number;
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'University Diploma' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'diploma' })
  @IsString()
  slug!: string;

  @ApiProperty({
    example: 'diploma',
    description:
      'national_id | diploma | affiliation | agreement | chifa | ordonnance | custom',
  })
  @IsString()
  docType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [CreateTemplateFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateFieldDto)
  fields?: CreateTemplateFieldDto[];
}
