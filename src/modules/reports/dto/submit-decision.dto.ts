import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReviewDecision {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RESUBMIT = 'resubmit',
}

export class SubmitDecisionDto {
  @ApiProperty({
    enum: ReviewDecision,
    description: 'Human review outcome for this verification',
    example: ReviewDecision.APPROVED,
  })
  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @ApiPropertyOptional({
    description:
      'Optional note explaining the decision (max 2 000 characters). ' +
      'Displayed to the tenant alongside the final verdict.',
    maxLength: 2000,
    example:
      'Medical licence number confirmed against official registry. ' +
      'CNAS affiliation valid as of verification date.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  decisionNote?: string;
}
