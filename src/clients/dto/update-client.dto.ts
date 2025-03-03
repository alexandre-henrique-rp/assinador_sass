import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsEmail,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class UpdateClientDto {
  @ApiProperty({ required: false, example: 'João Silva' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, example: '1990-01-01' })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  birthDate?: string;

  @ApiProperty({ required: false, example: 'joao@exemplo.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: 'joaosilva' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ required: false, example: 'senha123' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
