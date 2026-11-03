import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsigniasController } from './insignias.controller';
import { InsigniasService } from './insignias.service';
import { CatalogoInsigniasController } from './catalogo-insignias.controller';
import { CatalogoInsigniasService } from './catalogo-insignias.service';
import { SolicitudesInsigniasController } from './solicitudes-insignias.controller';
import { SolicitudesInsigniasService } from './solicitudes-insignias.service';
import { SolicitudesPdfService } from './solicitudes-pdf.service';
import { Insignia } from './entities/insignia.entity';
import { Camisola } from './entities/camisola.entity';
import { CatalogoInsignia } from './entities/catalogo-insignia.entity';
import { SolicitudInsignias } from './entities/solicitud-insignias.entity';
import { SolicitudInsigniasLinea } from './entities/solicitud-insignias-linea.entity';
import { User } from '../users/entities/user.entity';
import { ProgresoModule } from '../progreso/progreso.module';
import { SeccionesModule } from '../secciones/secciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Insignia,
      Camisola,
      User,
      CatalogoInsignia,
      SolicitudInsignias,
      SolicitudInsigniasLinea,
    ]),
    SeccionesModule,
    ProgresoModule,
  ],
  // El orden importa: InsigniasController tiene @Get(':caminanteId') con
  // ParseIntPipe y se comería las rutas 'catalogo' y 'solicitudes' si fuera
  // el primero del arreglo.
  controllers: [
    CatalogoInsigniasController,
    SolicitudesInsigniasController,
    InsigniasController,
  ],
  providers: [
    InsigniasService,
    CatalogoInsigniasService,
    SolicitudesInsigniasService,
    SolicitudesPdfService,
  ],
  exports: [InsigniasService, CatalogoInsigniasService],
})
export class InsigniasModule {}
