import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { MulterModule } from '@nestjs/platform-express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CertificatesModule } from './certificates/certificates.module';
import { ClientsModule } from './clients/clients.module';
import { DocumentsModule } from './documents/documents.module';
import { BiometricsModule } from './biometrics/biometrics.module';
import { SignaturesModule } from './signatures/signatures.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    MulterModule.register({
      dest: join(__dirname, '..', 'uploads'),
    }),
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
