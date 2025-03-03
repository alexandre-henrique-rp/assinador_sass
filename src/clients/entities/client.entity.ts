import { CertificateEntity } from '../../certificates/entities/certificate.entity';
import { DocumentEntity } from '../../documents/entities/document.entity';
import { Exclude, Transform } from 'class-transformer';
import { ApiResponseProperty } from '@nestjs/swagger';

export class ClientEntity {
  @ApiResponseProperty({ type: String })
  id: string;

  @ApiResponseProperty({ type: String })
  name: string;

  @ApiResponseProperty({ type: String })
  @Transform(({ value }) =>
    value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
  )
  cpf: string;

  @ApiResponseProperty({ type: Date })
  @Transform(({ value }) =>
    value.toISOString().split('T')[0].split('-').reverse().join('/'),
  )
  birthDate: Date;

  @ApiResponseProperty({ type: String })
  email: string;

  @ApiResponseProperty({ type: String })
  username: string;

  @ApiResponseProperty({ type: String })
  @Exclude()
  password?: string;

  @ApiResponseProperty({ type: Boolean })
  hasCertificate: boolean;

  @ApiResponseProperty({ type: Boolean })
  isCertificateValid: boolean;

  @ApiResponseProperty({ type: Boolean })
  isActive: boolean;

  @ApiResponseProperty({ type: String })
  documentPhotoUrl: string;

  @ApiResponseProperty({ type: String })
  facialPhotoUrl: string;

  @ApiResponseProperty({ type: [CertificateEntity] })
  certificates: CertificateEntity[];

  @ApiResponseProperty({ type: [DocumentEntity] })
  documents: DocumentEntity[];

  @ApiResponseProperty({ type: Date })
  createdAt: Date;

  @ApiResponseProperty({ type: Date })
  updatedAt: Date;

  constructor(partial: Partial<ClientEntity>) {
    Object.assign(this, partial);
  }
}
