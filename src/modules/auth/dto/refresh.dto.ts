import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Long-lived refresh token returned by /auth/login',
  })
  @IsString()
  refreshToken!: string;
}
