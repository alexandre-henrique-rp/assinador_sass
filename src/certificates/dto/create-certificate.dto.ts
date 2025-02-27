import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateCertificateDto {
  @ApiProperty({ example: 'João Silva' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '123.456.789-00' })
  @IsNotEmpty()
  @IsString()
  cpf: string;

  @ApiProperty({ example: '1990-01-01' })
  @IsNotEmpty()
  @IsString()
  birthDate: string;

  @ApiProperty({ required: false, example: '365' })
  @IsOptional()
  @IsString()
  validityDays?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isCA?: boolean;
}
