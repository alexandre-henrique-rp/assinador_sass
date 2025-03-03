import { Module } from '@nestjs/common';
import { SignaturesService } from './services/signatures.service';
import { SignaturesController } from './controllers/signatures.controller';
import { ClientsModule } from '../clients/clients.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { DocumentsModule } from '../documents/documents.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ClientsModule, CertificatesModule, DocumentsModule, PrismaModule],
  controllers: [SignaturesController],
  providers: [SignaturesService],
  exports: [SignaturesService],
})
export class SignaturesModule {}
