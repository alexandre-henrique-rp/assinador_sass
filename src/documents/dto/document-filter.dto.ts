import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class DocumentFilterDto {
  @ApiProperty({ example: '123.456.789-00' })
  @IsNotEmpty()
  @IsString()
  cpf: string;
  
  @ApiProperty({ required: false, example: 'pdf' })
  @IsOptional()
  @IsString()
  extension?: string;
}
