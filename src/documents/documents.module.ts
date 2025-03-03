import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DocumentsService } from './services/documents.service';
import { DocumentsController } from './controllers/documents.controller';
import { ClientsModule } from '../clients/clients.module';
import { PrismaModule } from '../prisma/prisma.module'; // Importar PrismaModule
import { join } from 'path';

@Module({
  imports: [
    ClientsModule,
    PrismaModule, // Adicionado
    MulterModule.register({
      dest: join(__dirname, '..', '..', 'uploads', 'documents'),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
