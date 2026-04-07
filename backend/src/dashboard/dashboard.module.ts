import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User } from '../users/entities/user.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { Insignia } from '../insignias/entities/insignia.entity';
import { SenderoProgreso } from '../progreso/entities/sendero-progreso.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Evidencia, Insignia, SenderoProgreso]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
