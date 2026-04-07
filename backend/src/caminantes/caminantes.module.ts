import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaminantesController } from './caminantes.controller';
import { CaminantesService } from './caminantes.service';
import { User } from '../users/entities/user.entity';
import { Insignia } from '../insignias/entities/insignia.entity';
import { InsigniasModule } from '../insignias/insignias.module';
import { ProgresoModule } from '../progreso/progreso.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Insignia]),
    ProgresoModule,
    InsigniasModule,
  ],
  controllers: [CaminantesController],
  providers: [CaminantesService],
  exports: [CaminantesService],
})
export class CaminantesModule {}
