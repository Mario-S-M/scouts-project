import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvisosSalidaService } from './avisos-salida.service';
import { AvisosSalidaController } from './avisos-salida.controller';
import { AvisoSalida } from './aviso-salida.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([AvisoSalida]), UsersModule],
  controllers: [AvisosSalidaController],
  providers: [AvisosSalidaService],
})
export class AvisosSalidaModule {}
