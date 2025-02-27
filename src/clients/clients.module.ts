import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ClientsService } from './services/clients.service';
import { ClientsController } from './controllers/clients.controller';
import { join } from 'path';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      dest: join(__dirname, '..', '..', 'uploads', 'clients'),
    }),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
