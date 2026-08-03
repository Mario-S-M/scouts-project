import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { ConfiguracionRecordatorioService } from './calendario/configuracion-recordatorio.service';
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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Scouts CC Backend running on port ${port}`);
}
bootstrap();
