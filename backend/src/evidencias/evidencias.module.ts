import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenciasController } from './evidencias.controller';
import { EvidenciasService } from './evidencias.service';
import { Evidencia } from './entities/evidencia.entity';
import { ProgresoModule } from '../progreso/progreso.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evidencia]),
    ProgresoModule,
  ],
  controllers: [EvidenciasController],
  providers: [EvidenciasService],
  exports: [EvidenciasService],
})
export class EvidenciasModule {}
