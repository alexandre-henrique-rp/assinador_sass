import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class DocumentFilterDto {
  @ApiProperty({ example: '123.456.789-00' })
  @IsNotEmpty()
  @IsString()
  cpf: string;

  @ApiProperty({ example: 'a003e132-d6eb-45e6-bf23-c4b2d1a4b4e5' })
  @IsNotEmpty()
  @IsString()
  admId: string;

  @ApiProperty({ required: false, example: 'pdf' })
  @IsOptional()
  @IsString()
  extension?: string;
}
