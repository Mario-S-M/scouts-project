import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InformesService } from './informes.service';
import { InformesController } from './informes.controller';
import { InformeMensual } from './entities/informe-mensual.entity';
import { AltaBajaInforme } from './entities/alta-baja-informe.entity';
import { AsistenciaActividad } from './entities/asistencia-actividad.entity';
import { ActividadPendiente } from './entities/actividad-pendiente.entity';
import { MovimientoFinanciero } from './entities/movimiento-financiero.entity';
import { InventarioItem } from './entities/inventario-item.entity';
import { ProgresionInforme } from './entities/progresion-informe.entity';
import { User } from '../users/entities/user.entity';
import { EspecialidadProgreso } from '../progreso/entities/especialidad-progreso.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    InformeMensual, AltaBajaInforme, AsistenciaActividad,
    ActividadPendiente, MovimientoFinanciero, InventarioItem, ProgresionInforme,
    User, EspecialidadProgreso,
  ])],
  controllers: [InformesController],
  providers: [InformesService],
})
export class InformesModule {}
