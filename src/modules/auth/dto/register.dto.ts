import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'admin@doctome.dz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SuperSecret123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'DoctomeDZ' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  companyName!: string;
}
