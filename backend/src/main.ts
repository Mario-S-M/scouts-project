import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { ConfiguracionRecordatorioService } from './calendario/configuracion-recordatorio.service';
import { CatalogoInsigniasService } from './insignias/catalogo-insignias.service';
import { AvisosSalidaService } from './avisos-salida/avisos-salida.service';
import { SeccionesService } from './secciones/secciones.service';
import { ActividadService } from './calendario/actividad.service';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Proxies propios delante del backend (1 = solo nginx). req.ip, y con él el límite
  // de intentos del login, depende de este número.
  const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
  app.set('trust proxy', Number.isFinite(hops) && hops >= 0 ? hops : 1);

  // TEMPORAL (spec login): averiguar cuántos proxies hay delante. Se quita en la Tarea 17.
  if (process.env.LOG_IP_LOGIN === '1') {
    app.use('/api/auth/login', (req, _res, next) => {
      console.log('[TEMPORAL ip-login]', JSON.stringify({ ip: req.ip, ips: req.ips, xff: req.headers['x-forwarded-for'], cf: req.headers['cf-connecting-ip'] }));
      next();
    });
  }

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Aplica los @Exclude de las entidades (contraseñas y códigos de Telegram)
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.setGlobalPrefix('api');

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Seed initial admin user
  const usersService = app.get(UsersService);
  await usersService.seedUsers();

  // Seed default reminder configuration (miércoles 10:00 por ámbito)
  const configuracionRecordatorioService = app.get(ConfiguracionRecordatorioService);
  await configuracionRecordatorioService.seedDefaults();

  // Seed del catálogo de insignias solicitables (17 ítems, idempotente)
  const catalogoInsigniasService = app.get(CatalogoInsigniasService);
  await catalogoInsigniasService.seedCatalogo();

  // Identidad de las secciones (nombres, colores, logo), idempotente
  await app.get(SeccionesService).seed();

  // Actividades de antes de tipos/visibilidad/varias secciones
  await app.get(ActividadService).completarCamposNuevos();

  // Avisos de antes del candado por sección: heredan la sección de su autor
  const avisosAsignados = await app.get(AvisosSalidaService).asignarSeccionFaltante();
  if (avisosAsignados) console.log(`Avisos con sección asignada: ${avisosAsignados}`);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Scouts CC Backend running on port ${port}`);
}
bootstrap();
