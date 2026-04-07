import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgresoService } from './progreso.service';
import { SenderoProgreso } from './entities/sendero-progreso.entity';
import { EspecialidadProgreso } from './entities/especialidad-progreso.entity';
import { AventuraProgreso } from './entities/aventura-progreso.entity';
import { IniciativaProgreso } from './entities/iniciativa-progreso.entity';
import { Evento } from './entities/evento.entity';
import { PuntaDeFlecha } from './entities/punta-de-flecha.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SenderoProgreso,
      EspecialidadProgreso,
      AventuraProgreso,
      IniciativaProgreso,
      Evento,
      PuntaDeFlecha,
    ]),
  ],
  providers: [ProgresoService],
  exports: [TypeOrmModule, ProgresoService],
})
export class ProgresoModule {}
