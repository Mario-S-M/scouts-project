import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { SenderoProgreso } from '../progreso/entities/sendero-progreso.entity';
import { EspecialidadProgreso } from '../progreso/entities/especialidad-progreso.entity';
import { AventuraProgreso } from '../progreso/entities/aventura-progreso.entity';
import { IniciativaProgreso } from '../progreso/entities/iniciativa-progreso.entity';
import { Evento } from '../progreso/entities/evento.entity';
import { PuntaDeFlecha } from '../progreso/entities/punta-de-flecha.entity';
import { Insignia } from '../insignias/entities/insignia.entity';
import { Camisola } from '../insignias/entities/camisola.entity';
import { AvisoSalida } from '../avisos-salida/aviso-salida.entity';
import { CicloPrograma } from '../ciclos-programa/entities/ciclo-programa.entity';
import { ActividadCiclo } from '../ciclos-programa/entities/actividad-ciclo.entity';
import { InformeMensual } from '../informes/entities/informe-mensual.entity';
import { AltaBajaInforme } from '../informes/entities/alta-baja-informe.entity';
import { AsistenciaActividad } from '../informes/entities/asistencia-actividad.entity';
import { ActividadPendiente } from '../informes/entities/actividad-pendiente.entity';
import { MovimientoFinanciero } from '../informes/entities/movimiento-financiero.entity';
import { InventarioItem } from '../informes/entities/inventario-item.entity';
import { ProgresionInforme } from '../informes/entities/progresion-informe.entity';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'scouts_cc',
  username: process.env.DB_USER || 'scouts_user',
  password: process.env.DB_PASSWORD || 'scouts_pass',
  entities: [
    User,
    Evidencia,
    SenderoProgreso,
    EspecialidadProgreso,
    AventuraProgreso,
    IniciativaProgreso,
    Evento,
    PuntaDeFlecha,
    Insignia,
    Camisola,
    AvisoSalida,
    CicloPrograma,
    ActividadCiclo,
    InformeMensual, AltaBajaInforme, AsistenciaActividad,
    ActividadPendiente, MovimientoFinanciero, InventarioItem, ProgresionInforme,
  ],
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
});
