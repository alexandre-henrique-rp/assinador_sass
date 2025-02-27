import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Document } from './entities/document.entity';
import { DocumentsService } from './services/documents.service';
import { DocumentsController } from './controllers/documents.controller';
import { ClientsModule } from '../clients/clients.module';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    ClientsModule,
    MulterModule.register({
      dest: join(__dirname, '..', '..', 'uploads', 'documents'),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
