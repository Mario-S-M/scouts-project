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
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { EvidenciasService } from './evidencias.service';
import { CreateEvidenciaDto, ValidarEvidenciaDto } from './dto/create-evidencia.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { assertPuedeEditar, assertPuedeVer, seccionParaVer } from '../common/rol-seccion.util';

const esScout = (req: any) => req.user?.rol === 'scout';

@UseGuards(JwtAuthGuard)
@Controller('evidencias')
export class EvidenciasController {
  constructor(private readonly evidenciasService: EvidenciasService) {}

  @Get()
  findAll(@Query('caminanteId') caminanteId?: string, @Request() req?) {
    // Un joven solo ve sus propias evidencias
    if (esScout(req)) return this.evidenciasService.findAll(req.user.id);
    return this.evidenciasService.findAll(
      caminanteId ? parseInt(caminanteId) : undefined,
      seccionParaVer(req.user) ?? undefined,
    );
  }

  @Get('pendientes')
  findPendientes(@Request() req) {
    return this.evidenciasService.findPendientes(seccionParaVer(req.user) ?? undefined);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const ev = await this.evidenciasService.findOne(id);
    if (esScout(req)) {
      if (ev.caminanteId !== req.user.id) throw new ForbiddenException('Esta evidencia no es tuya');
    } else {
      assertPuedeVer(req.user, await this.evidenciasService.seccionDeCaminante(ev.caminanteId));
    }
    return ev;
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
    @Request() req,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // El joven sube solo para sí mismo; el scouter, para jóvenes de su sección
    const caminanteId = Number(dto.caminanteId);
    try {
      if (esScout(req)) {
        if (caminanteId !== req.user.id) throw new ForbiddenException('Solo puedes subir evidencias propias');
      } else {
        assertPuedeEditar(req.user, await this.evidenciasService.seccionDeCaminante(caminanteId));
      }
    } catch (e) {
      // Multer ya guardó el archivo; si no hay permiso, no se queda en disco
      if (file?.path) fs.promises.unlink(file.path).catch(() => undefined);
      throw e;
    }
    const archivoUrl = file ? `/uploads/evidencias/${file.filename}` : undefined;
    return this.evidenciasService.create(dto, archivoUrl);
  }

  @Put(':id/validar')
  async validar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidarEvidenciaDto,
    @Request() req,
  ) {
    const ev = await this.evidenciasService.findOne(id);
    assertPuedeEditar(req.user, await this.evidenciasService.seccionDeCaminante(ev.caminanteId));
    return this.evidenciasService.validar(id, dto);
  }
}
