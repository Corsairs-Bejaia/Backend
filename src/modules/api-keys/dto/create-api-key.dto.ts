import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production Key' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: ['verifications:read', 'verifications:write'],
    description: 'Scope permissions granted to this key',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ example: 100, description: 'Max requests per minute' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimit?: number;
}
