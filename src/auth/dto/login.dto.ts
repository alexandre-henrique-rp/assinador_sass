import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'usuario1' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: 'senha123' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
