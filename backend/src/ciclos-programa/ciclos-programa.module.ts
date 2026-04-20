import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CiclosProgramaService } from './ciclos-programa.service';
import { CiclosProgramaController } from './ciclos-programa.controller';
import { CicloPrograma } from './entities/ciclo-programa.entity';
import { ActividadCiclo } from './entities/actividad-ciclo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CicloPrograma, ActividadCiclo])],
  controllers: [CiclosProgramaController],
  providers: [CiclosProgramaService],
})
export class CiclosProgramaModule {}
