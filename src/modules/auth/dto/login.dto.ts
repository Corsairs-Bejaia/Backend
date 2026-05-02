import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@doctome.dz' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
