import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class DocumentFilterDto {
  @ApiProperty({ example: '123.456.789-00' })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value.replace(/\D/g, ''))
  cpf: string;
}
