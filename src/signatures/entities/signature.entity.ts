import { DocumentEntity } from 'src/documents/entities/document.entity';
import { ClientEntity } from '../../clients/entities/client.entity';
import { ApiResponseProperty } from '@nestjs/swagger';
import { CertificateEntity } from 'src/certificates/entities/certificate.entity';

export enum SignatureType {
  ADVANCED = 'Avançada',
  ICP_BRASIL = 'ICP-Brasil',
}

export class Signature {
  @ApiResponseProperty({ type: String })
  id: string;

  @ApiResponseProperty({ type: ClientEntity })
  signer: ClientEntity;

  @ApiResponseProperty({ type: String })
  signerId: string;

  @ApiResponseProperty({ type: String })
  signerCpf: string;

  @ApiResponseProperty({ type: Date })
  signedAt: Date;

  @ApiResponseProperty({ enum: SignatureType })
  type: string;

  @ApiResponseProperty({ type: String })
  certificateId: string;

  @ApiResponseProperty({ type: CertificateEntity })
  certificate: CertificateEntity;

  @ApiResponseProperty({ type: String })
  documentId: string;

  @ApiResponseProperty({ type: DocumentEntity })
  document: DocumentEntity;

  @ApiResponseProperty({ type: String })
  signatureData: string;
}
