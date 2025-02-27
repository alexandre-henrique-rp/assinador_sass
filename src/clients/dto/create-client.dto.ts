import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsDateString, IsOptional } from 'class-validator';

export class CreateClientDto {
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
  @IsDateString()
  birthDate: string;

  @ApiProperty({ example: 'joao@exemplo.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'joaosilva' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: 'senha123' })
  @IsNotEmpty()
  @IsString()
  password: string;
  
  @ApiProperty({ required: false, example: true })
  @IsOptional()
  isActive?: boolean;
}
