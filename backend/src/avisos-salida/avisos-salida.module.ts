import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvisosSalidaService } from './avisos-salida.service';
import { AvisosSalidaController } from './avisos-salida.controller';
import { ProtocoloTrasladoService } from './protocolo-traslado.service';
import { AvisoSalida } from './aviso-salida.entity';
import { UsersModule } from '../users/users.module';
import { SeccionesModule } from '../secciones/secciones.module';

@Module({
  imports: [TypeOrmModule.forFeature([AvisoSalida]), UsersModule, SeccionesModule],
  controllers: [AvisosSalidaController],
  providers: [AvisosSalidaService, ProtocoloTrasladoService],
})
export class AvisosSalidaModule {}
