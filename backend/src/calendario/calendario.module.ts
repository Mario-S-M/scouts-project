import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actividad } from './entities/actividad.entity';
import { ConfiguracionRecordatorio } from './entities/configuracion-recordatorio.entity';
import { User } from '../users/entities/user.entity';
import { ActividadService } from './actividad.service';
import { ActividadController } from './actividad.controller';
import { ConfiguracionRecordatorioService } from './configuracion-recordatorio.service';
import { ConfiguracionRecordatorioController } from './configuracion-recordatorio.controller';
import { RecordatoriosService } from './recordatorios.service';
import { RecordatoriosController } from './recordatorios.controller';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Actividad, ConfiguracionRecordatorio, User]),
    TelegramModule,
  ],
  controllers: [ActividadController, ConfiguracionRecordatorioController, RecordatoriosController],
  providers: [ActividadService, ConfiguracionRecordatorioService, RecordatoriosService],
  exports: [ConfiguracionRecordatorioService],
})
export class CalendarioModule {}
