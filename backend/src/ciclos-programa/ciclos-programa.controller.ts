import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Res, Req,
  NotFoundException,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CiclosProgramaService } from './ciclos-programa.service';
import { CrearCicloDto } from './dto/ciclo-programa.dto';
import { assertPuedeEditar, assertPuedeVer, seccionParaCrear, seccionParaVer } from '../common/rol-seccion.util';

@UseGuards(JwtAuthGuard)
@Controller('ciclos-programa')
export class CiclosProgramaController {
  constructor(private readonly service: CiclosProgramaService) {}

  /** Listar todos los ciclos */
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(seccionParaVer(req.user));
  }

  /** Actividades del ciclo de programa que caen en un mes/año específico */
  @Get('actividades-mes/:seccion/:anio/:mes')
  findActividadesMes(
    @Param('seccion') seccion: string,
    @Param('anio', ParseIntPipe) anio: number,
    @Param('mes', ParseIntPipe) mes: number,
    @Req() req: any,
  ) {
    assertPuedeVer(req.user, seccion);
    return this.service.findActividadesMes(seccion, anio, mes);
  }

  /** PDF anual: todos los ciclos de una sección en un año (antes de :id) */
  @Get('anual/pdf')
  async getPdfAnual(
    @Query('anio', ParseIntPipe) anio: number,
    @Query('seccion') seccion: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    assertPuedeVer(req.user, seccion);
    const ciclos = await this.service.findByAnioSeccion(anio, seccion);
    if (!ciclos.length) {
      throw new NotFoundException(`No hay ciclos en ${anio} para la sección ${seccion}`);
    }
    const buffer = await this.service.generatePdfAnual(ciclos, anio, seccion, req.user?.nombre ?? '');
    const safeSeccion = (seccion ?? '').replace(/[^a-z0-9_-]/gi, '');
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="ciclo-programa-anual-${safeSeccion}-${anio}.pdf"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  /** Obtener un ciclo */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const ciclo = await this.service.findOne(id);
    assertPuedeVer(req.user, ciclo.seccion);
    return ciclo;
  }

  /** Crear ciclo */
  @Post()
  create(@Body() dto: CrearCicloDto, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? 0;
    dto.seccion = seccionParaCrear(req.user, dto.seccion);
    return this.service.create(dto, userId);
  }

  /** Actualizar ciclo */
  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: CrearCicloDto, @Req() req: any) {
    assertPuedeEditar(req.user, (await this.service.findOne(id)).seccion);
    return this.service.update(id, dto);
  }

  /** Eliminar ciclo */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    assertPuedeEditar(req.user, (await this.service.findOne(id)).seccion);
    return this.service.remove(id);
  }

  /** Descargar PDF de ciclo guardado */
  @Get(':id/pdf')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response, @Req() req: any) {
    const ciclo  = await this.service.findOne(id);
    assertPuedeVer(req.user, ciclo.seccion);
    const autor  = req.user?.nombre ?? ciclo.creadoPor?.nombre ?? '';
    const buffer = await this.service.generatePdf(ciclo, autor);
    const filename = `ciclo-programa-${ciclo.nombre.replace(/\s+/g, '-')}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  /** Generar PDF sin guardar (preview) */
  @Post('pdf-preview')
  async previewPdf(@Body() dto: CrearCicloDto, @Res() res: Response, @Req() req: any) {
    const autor = req.user?.nombre ?? '';
    // Build a temporary ciclo object from dto
    const tempCiclo: any = {
      ...dto,
      id: 0,
      creadoPorId: 0,
      actividades: dto.actividades.map((a, i) => ({ ...a, id: i, cicloId: 0 })),
      createdAt: new Date(),
    };
    const buffer = await this.service.generatePdf(tempCiclo, autor);
    const filename = `ciclo-programa-${(dto.nombre || 'borrador').replace(/\s+/g, '-')}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }
}
