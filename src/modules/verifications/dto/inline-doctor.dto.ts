import { IsString, IsOptional, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InlineDoctorDto {
  @ApiProperty({ example: 'Ahmed Benali' })
  @IsString()
  fullNameFr!: string;

  @ApiPropertyOptional({ example: 'أحمد بن علي' })
  @IsOptional()
  @IsString()
  fullNameAr?: string;

  @ApiProperty({
    description: 'Algerian NIN — 18 digits',
    example: '198501234567890123',
  })
  @IsString()
  @Length(18, 18, { message: 'nationalIdNumber must be exactly 18 digits' })
  @Matches(/^\d{18}$/, { message: 'nationalIdNumber must contain only digits' })
  nationalIdNumber!: string;
}
