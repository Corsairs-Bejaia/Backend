import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUrl,
  IsString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsIn,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { WebhookEventType } from '../event-types';

const VALID_EVENT_TYPES = Object.values(WebhookEventType);

export class UpdateEndpointDto {
  @ApiPropertyOptional({ example: 'https://yourapp.com/webhooks' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional({ example: 'Production webhook' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    example: ['verification.completed'],
    enum: VALID_EVENT_TYPES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(VALID_EVENT_TYPES, { each: true })
  eventTypes?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
