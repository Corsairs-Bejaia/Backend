import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTemplateFieldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fieldLabelFr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fieldLabelAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fieldType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validationRegex?: string;

  @ApiPropertyOptional()
  @IsOptional()
  sortOrder?: number;
}
