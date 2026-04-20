import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';
import { databaseConfig } from './common/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CaminantesModule } from './caminantes/caminantes.module';
import { EvidenciasModule } from './evidencias/evidencias.module';
import { InsigniasModule } from './insignias/insignias.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProgresoModule } from './progreso/progreso.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AvisosSalidaModule } from './avisos-salida/avisos-salida.module';
import { CiclosProgramaModule } from './ciclos-programa/ciclos-programa.module';
import { InformesModule } from './informes/informes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: databaseConfig,
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ProgresoModule,
    CaminantesModule,
    EvidenciasModule,
    InsigniasModule,
    DashboardModule,
    UsersModule,
    AuthModule,
    AvisosSalidaModule,
    CiclosProgramaModule,
    InformesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
