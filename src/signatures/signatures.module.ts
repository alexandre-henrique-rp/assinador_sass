import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Signature } from './entities/signature.entity';
import { SignaturesService } from './services/signatures.service';
import { SignaturesController } from './controllers/signatures.controller';
import { ClientsModule } from '../clients/clients.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Signature]),
    ClientsModule,
    CertificatesModule,
    DocumentsModule,
  ],
  controllers: [SignaturesController],
  providers: [SignaturesService],
  exports: [SignaturesService],
})
export class SignaturesModule {}
