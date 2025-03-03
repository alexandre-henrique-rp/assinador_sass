import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { SignatureType } from '../entities/signature.entity';

export class CreateSignatureDto {
  @ApiProperty({ example: '123.456.789-00' })
  @IsNotEmpty()
  @IsString()
  signerCpf: string;

  @ApiProperty({ example: 'uuid-do-documento' })
  @IsNotEmpty()
  @IsString()
  documentId: string;

  @ApiProperty({ enum: SignatureType, example: SignatureType.ADVANCED })
  @IsNotEmpty()
  @IsEnum(SignatureType)
  type: SignatureType;

  @ApiProperty({ required: false, example: 'uuid-do-certificado' })
  @IsOptional()
  @IsString()
  certificateId?: string;

  @ApiProperty({ required: false, example: 'uuid-do-certificado' })
  @IsOptional()
  @IsString()
  signerId?: string;
}
