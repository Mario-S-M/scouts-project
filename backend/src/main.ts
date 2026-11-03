import { NestFactory } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { ConfiguracionRecordatorioService } from './calendario/configuracion-recordatorio.service';
import { CatalogoInsigniasService } from './insignias/catalogo-insignias.service';
import { AvisosSalidaService } from './avisos-salida/avisos-salida.service';
import { SeccionesService } from './secciones/secciones.service';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Avisos de antes del candado por sección: heredan la sección de su autor
  const avisosAsignados = await app.get(AvisosSalidaService).asignarSeccionFaltante();
  if (avisosAsignados) console.log(`Avisos con sección asignada: ${avisosAsignados}`);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Scouts CC Backend running on port ${port}`);
}
bootstrap();
