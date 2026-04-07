import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { EvidenciasService } from './evidencias.service';
import { CreateEvidenciaDto, ValidarEvidenciaDto } from './dto/create-evidencia.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getSeccionFromRol } from '../common/rol-seccion.util';

@UseGuards(JwtAuthGuard)
@Controller('evidencias')
export class EvidenciasController {
  constructor(private readonly evidenciasService: EvidenciasService) {}

  @Get()
  findAll(@Query('caminanteId') caminanteId?: string, @Request() req?) {
    const seccion = getSeccionFromRol(req.user.rol);
    return this.evidenciasService.findAll(
      caminanteId ? parseInt(caminanteId) : undefined,
      seccion,
    );
  }

  @Get('pendientes')
  findPendientes(@Request() req) {
    const seccion = getSeccionFromRol(req.user.rol);
    return this.evidenciasService.findPendientes(seccion);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.evidenciasService.findOne(id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = process.env.UPLOAD_DIR || './uploads';
          const dir = path.join(uploadDir, 'evidencias');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          const safe = file.originalname
            .replace(/[^a-zA-Z0-9]/g, '-')
            .toLowerCase();
          cb(null, `ev-${Date.now()}-${safe}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async create(
    @Body() dto: CreateEvidenciaDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const archivoUrl = file ? `/uploads/evidencias/${file.filename}` : undefined;
    return this.evidenciasService.create(dto, archivoUrl);
  }

  @Put(':id/validar')
  validar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidarEvidenciaDto,
  ) {
    return this.evidenciasService.validar(id, dto);
  }
}
