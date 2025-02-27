import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CertificatesService } from './services/certificates.service';
import { CertificatesController } from './controllers/certificates.controller';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [PrismaModule, ClientsModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
