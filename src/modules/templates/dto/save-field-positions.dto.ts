import { ApiProperty } from '@nestjs/swagger';

export class SaveFieldPositionsDto {
  @ApiProperty({
    description:
      'Map of fieldName → relative coordinates { x, y, width, height } (0.0–1.0)',
    example: { full_name_fr: { x: 0.1, y: 0.15, width: 0.6, height: 0.05 } },
  })
  positions!: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >;
}
