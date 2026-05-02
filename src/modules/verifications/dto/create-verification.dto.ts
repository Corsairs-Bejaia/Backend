import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVerificationDto {
  @ApiProperty({ description: 'Doctor ID to run the verification for' })
  @IsString()
  doctorId!: string;

  @ApiPropertyOptional({
    description: 'Optional workflow config overrides (JSON)',
  })
  @IsOptional()
  @IsObject()
  workflowConfig?: Record<string, unknown>;
}
