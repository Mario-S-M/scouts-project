import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsigniasController } from './insignias.controller';
import { InsigniasService } from './insignias.service';
import { Insignia } from './entities/insignia.entity';
import { Camisola } from './entities/camisola.entity';
import { User } from '../users/entities/user.entity';
import { ProgresoModule } from '../progreso/progreso.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Insignia, Camisola, User]),
    ProgresoModule,
  ],
  controllers: [InsigniasController],
  providers: [InsigniasService],
  exports: [InsigniasService],
})
export class InsigniasModule {}
