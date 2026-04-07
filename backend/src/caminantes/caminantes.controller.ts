import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
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
import { CaminantesService } from './caminantes.service';
import { CreateCaminanteDto } from './dto/create-caminante.dto';
import { InsigniasService } from '../insignias/insignias.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getSeccionFromRol } from '../common/rol-seccion.util';

@UseGuards(JwtAuthGuard)
@Controller('caminantes')
export class CaminantesController {
  constructor(
    private readonly caminantesService: CaminantesService,
    private readonly insigniasService: InsigniasService,
  ) {}

  @Get()
  findAll(@Request() req) {
    const seccion = getSeccionFromRol(req.user.rol);
    return this.caminantesService.findAll(seccion);
  }

  @Post()
  create(@Body() dto: CreateCaminanteDto) {
    return this.caminantesService.create(dto);
  }

  // ── Rutas del scout autenticado (deben ir ANTES de :id) ──────────────────

  @Get('me')
  getMe(@Request() req) {
    return this.caminantesService.findOne(req.user.id);
  }

  @Get('me/progreso')
  getMiProgreso(@Request() req) {
    return this.caminantesService.getProgreso(req.user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const seccion = getSeccionFromRol(req.user.rol);
    return this.caminantesService.findOne(id, seccion);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateCaminanteDto>,
    @Request() req,
  ) {
    const seccion = getSeccionFromRol(req.user.rol);
    return this.caminantesService.update(id, dto, seccion);
  }

  @Get(':id/progreso')
  async getProgreso(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const seccion = getSeccionFromRol(req.user.rol);
    // Verify access before returning progreso
    await this.caminantesService.findOne(id, seccion);
    return this.caminantesService.getProgreso(id);
  }

  @Get(':id/insignias')
  async getInsignias(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const seccion = getSeccionFromRol(req.user.rol);
    await this.caminantesService.findOne(id, seccion);
    return this.insigniasService.getInsignias(id);
  }

  @Post(':id/foto')
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = process.env.UPLOAD_DIR || './uploads';
          const dir = path.join(uploadDir, 'fotos');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `caminante-${req.params.id}-${Date.now()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
      },
    }),
  )
  async uploadFoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) return { error: 'Invalid file type' };
    const seccion = getSeccionFromRol(req.user.rol);
    const url = `/uploads/fotos/${file.filename}`;
    return this.caminantesService.update(id, { foto: url }, seccion);
  }
}
