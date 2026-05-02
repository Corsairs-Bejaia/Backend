import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUrl,
  IsString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  IsIn,
  MaxLength,
} from 'class-validator';
import { WebhookEventType } from '../event-types';

const VALID_EVENT_TYPES = Object.values(WebhookEventType);

export class CreateEndpointDto {
  @ApiProperty({ example: 'https://yourapp.com/webhooks' })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiPropertyOptional({ example: 'Production webhook' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description:
      'Event types to subscribe to. Omit (or leave empty) to receive all events.',
    example: ['verification.completed', 'report.reviewed'],
    enum: VALID_EVENT_TYPES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(VALID_EVENT_TYPES, { each: true })
  eventTypes?: string[];
}
