import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // 🚀 Importe o ConfigModule
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { DocumentsModule } from './documents/documents.module';
import { BiometricsModule } from './biometrics/biometrics.module';
import { SignaturesModule } from './signatures/signatures.module';
import { CertificatesModule } from './certificates/certificates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // 🚀 Adicione esta linha
    AuthModule,
    CertificatesModule,
    ClientsModule,
    DocumentsModule,
    BiometricsModule,
    SignaturesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
