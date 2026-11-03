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
import { GuardarTutoresDto } from './dto/tutores.dto';
import { InsigniasService } from '../insignias/insignias.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { seccionParaVer } from '../common/rol-seccion.util';

@UseGuards(JwtAuthGuard)
@Controller('caminantes')
export class CaminantesController {
  constructor(
    private readonly caminantesService: CaminantesService,
    private readonly insigniasService: InsigniasService,
  ) {}

  @Get()
  findAll(@Request() req) {
    return this.caminantesService.findAll(seccionParaVer(req.user));
  }

  /** Solo el scouter de la sección (o el administrador, indicando la sección) */
  @Post()
  create(@Body() dto: CreateCaminanteDto, @Request() req) {
    return this.caminantesService.create(dto, req.user);
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
    return this.caminantesService.findOne(id, req.user);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateCaminanteDto>,
    @Request() req,
  ) {
    return this.caminantesService.update(id, dto, req.user);
  }

  @Get(':id/tutores')
  getTutores(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.caminantesService.getTutores(id, req.user);
  }

  @Put(':id/tutores')
  guardarTutores(@Param('id', ParseIntPipe) id: number, @Body() dto: GuardarTutoresDto, @Request() req) {
    return this.caminantesService.guardarTutores(id, dto.tutores, req.user);
  }

  @Get(':id/progreso')
  async getProgreso(@Param('id', ParseIntPipe) id: number, @Request() req) {
    await this.caminantesService.findOne(id, req.user);
    return this.caminantesService.getProgreso(id);
  }

  @Get(':id/insignias')
  async getInsignias(@Param('id', ParseIntPipe) id: number, @Request() req) {
    await this.caminantesService.findOne(id, req.user);
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
    const url = `/uploads/fotos/${file.filename}`;
    return this.caminantesService.update(id, { foto: url }, req.user);
  }
}
