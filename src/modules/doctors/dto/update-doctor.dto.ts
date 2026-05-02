import { IsString, IsOptional, IsIn, Length, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const DOCTOR_STATUSES = [
  'pending',
  'verified',
  'rejected',
  'manual_review',
] as const;

export class UpdateDoctorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullNameFr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullNameAr?: string;

  @ApiPropertyOptional({ description: 'Algerian NIN — 18 digits' })
  @IsOptional()
  @IsString()
  @Length(18, 18, { message: 'nationalIdNumber must be exactly 18 digits' })
  @Matches(/^\d{18}$/, { message: 'nationalIdNumber must contain only digits' })
  nationalIdNumber?: string;

  @ApiPropertyOptional({ enum: DOCTOR_STATUSES })
  @IsOptional()
  @IsIn(DOCTOR_STATUSES)
  status?: string;
}
