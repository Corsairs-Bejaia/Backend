import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddCommentDto {
  @ApiProperty({
    description: 'Comment text (1–2 000 characters)',
    minLength: 1,
    maxLength: 2000,
    example:
      'The diploma scan on page 2 is illegible. Please ask the doctor to re-upload a higher-resolution version.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
