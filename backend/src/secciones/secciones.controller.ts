import {
  Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { SeccionesService } from './secciones.service';
import { ActualizarSeccionDto } from './dto/actualizar-seccion.dto';

/** Identidad de las secciones: la consulta cualquier usuario; la edita solo el administrador */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('secciones')
export class SeccionesController {
  constructor(private readonly service: SeccionesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':clave')
  findOne(@Param('clave') clave: string) {
    return this.service.findOne(clave);
  }

  @Put(':clave')
  @Roles(UserRole.ADMINISTRADOR)
  update(@Param('clave') clave: string, @Body() dto: ActualizarSeccionDto) {
    return this.service.update(clave, dto);
  }

  @Post(':clave/logo')
  @Roles(UserRole.ADMINISTRADOR)
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'secciones');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        // Nombre con fecha: así el navegador no se queda con el logo anterior en caché
        filename: (req, file, cb) => cb(null, `${req.params.clave}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
      }),
      fileFilter: (req, file, cb) => cb(null, ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file.originalname).toLowerCase())),
      limits: { fileSize: 3 * 1024 * 1024 },
    }),
  )
  async subirLogo(@Param('clave') clave: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Sube una imagen PNG, JPG o WEBP de máximo 3 MB');
    return this.service.setLogo(clave, `/uploads/secciones/${file.filename}`);
  }

  @Delete(':clave/logo')
  @Roles(UserRole.ADMINISTRADOR)
  quitarLogo(@Param('clave') clave: string) {
    return this.service.setLogo(clave, null);
  }
}
