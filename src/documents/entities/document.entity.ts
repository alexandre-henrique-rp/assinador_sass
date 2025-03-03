import { ClientEntity } from '../../clients/entities/client.entity';
import { Signature } from '../../signatures/entities/signature.entity';
import { ApiResponseProperty } from '@nestjs/swagger';

export class DocumentEntity {
  @ApiResponseProperty({ type: String })
  id: string;

  @ApiResponseProperty({ type: String })
  originalName: string;

  @ApiResponseProperty({ type: Number })
  size: number;

  @ApiResponseProperty({ type: String })
  documentType: string;

  @ApiResponseProperty({ type: String })
  extension: string;

  @ApiResponseProperty({ type: String })
  hash: string;

  @ApiResponseProperty({ type: String })
  storagePath: string;

  @ApiResponseProperty({ type: String })
  downloadUrl: string;

  @ApiResponseProperty({ type: String })
  viewUrl: string;

  @ApiResponseProperty({ type: Boolean })
  isSigned: boolean;

  @ApiResponseProperty({ type: ClientEntity })
  client: ClientEntity;

  @ApiResponseProperty({ type: String })
  clientId: string;

  @ApiResponseProperty({ type: [Signature] })
  signatures: Signature[];

  @ApiResponseProperty({ type: Date })
  createdAt: Date;

  @ApiResponseProperty({ type: Date })
  updatedAt: Date;
}
