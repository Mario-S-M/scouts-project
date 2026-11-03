import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeccionConfig } from './seccion-config.entity';
import { SeccionesService } from './secciones.service';
import { SeccionesController } from './secciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SeccionConfig])],
  controllers: [SeccionesController],
  providers: [SeccionesService],
  exports: [SeccionesService],
})
export class SeccionesModule {}
