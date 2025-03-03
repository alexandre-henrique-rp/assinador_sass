import { Module } from '@nestjs/common';
import { CertificatesService } from './services/certificates.service';
import { CertificatesController } from './controllers/certificates.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Ajuste o caminho conforme necessário
import { ClientsModule } from '../clients/clients.module'; // Ajuste o caminho conforme necessário

@Module({
  imports: [
    PrismaModule, // Importa o módulo que fornece o PrismaService
    ClientsModule, // Importa o módulo que fornece o ClientsService
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
