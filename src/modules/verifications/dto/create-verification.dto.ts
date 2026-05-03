import {
  IsString,
  IsOptional,
  IsObject,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InlineDoctorDto } from './inline-doctor.dto';

export class CreateVerificationDto {
  @ApiPropertyOptional({
    description:
      'ID of an existing doctor already registered under this tenant. ' +
      'Mutually exclusive with `doctor`.',
    example: 'clx9doc00001',
  })
  @IsOptional()
  @IsString()
  doctorId?: string;

  @ApiPropertyOptional({
    description:
      'Inline doctor data. The doctor is found-or-created by `nationalIdNumber` ' +
      'within your tenant. Mutually exclusive with `doctorId`.',
    type: () => InlineDoctorDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineDoctorDto)
  doctor?: InlineDoctorDto;

  @ApiPropertyOptional({
    description:
      'URL to redirect the doctor back to after the portal verification session ' +
      'completes. An HMAC-SHA256 signature is appended as `sig` so you can verify ' +
      'the redirect was issued by Meayar.',
    example: 'https://clinic.dz/verification-done',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  redirectUrl?: string;

  @ApiPropertyOptional({
    description: 'Optional workflow config overrides (JSON)',
  })
  @IsOptional()
  @IsObject()
  workflowConfig?: Record<string, unknown>;
}
