import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BiometricsService } from './services/biometrics.service';
import { BiometricsController } from './controllers/biometrics.controller';
import { ClientsModule } from '../clients/clients.module';
import { join } from 'path';

@Module({
  imports: [
    ClientsModule,
    MulterModule.register({
      dest: join(__dirname, '..', '..', 'uploads', 'biometrics'),
    }),
  ],
  controllers: [BiometricsController],
  providers: [BiometricsService],
  exports: [BiometricsService],
})
export class BiometricsModule {}
