import { Exclude } from 'class-transformer';
import { ClientEntity } from 'src/clients/entities/client.entity';
import { ApiResponseProperty } from '@nestjs/swagger';

export class CertificateEntity {
  @ApiResponseProperty({ type: String })
  id: string;

  @ApiResponseProperty({ type: String })
  subject: string;

  @ApiResponseProperty({ type: String })
  serialNumber: string;

  @ApiResponseProperty({ type: String })
  publicKey: string;

  @ApiResponseProperty({ type: String })
  @Exclude()
  privateKey: string;

  @ApiResponseProperty({ type: String })
  issuedAt: Date;

  @ApiResponseProperty({ type: String })
  validUntil: Date;

  @ApiResponseProperty({ type: Boolean })
  isValid: boolean;

  @ApiResponseProperty({ type: String })
  issuer: string;

  @ApiResponseProperty({ type: String })
  certificatePem: string;

  @ApiResponseProperty({ type: CertificateEntity })
  client?: ClientEntity;

  @ApiResponseProperty({ type: String })
  clientId: string;

  @ApiResponseProperty({ type: Boolean })
  isCA: boolean;

  @ApiResponseProperty({ type: String })
  createdAt: Date;

  @ApiResponseProperty({ type: String })
  updatedAt: Date;

  constructor(partial: Partial<CertificateEntity>) {
    Object.assign(this, partial);
  }
}
