import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Res, Req,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CiclosProgramaService } from './ciclos-programa.service';
import { CrearCicloDto } from './dto/ciclo-programa.dto';

@UseGuards(JwtAuthGuard)
@Controller('ciclos-programa')
export class CiclosProgramaController {
  constructor(private readonly service: CiclosProgramaService) {}

  /** Listar todos los ciclos */
  @Get()
  findAll() {
    return this.service.findAll();
  }

  /** Actividades del ciclo de programa que caen en un mes/año específico */
  @Get('actividades-mes/:seccion/:anio/:mes')
  findActividadesMes(
    @Param('seccion') seccion: string,
    @Param('anio', ParseIntPipe) anio: number,
    @Param('mes', ParseIntPipe) mes: number,
  ) {
    return this.service.findActividadesMes(seccion, anio, mes);
  }

  /** Obtener un ciclo */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  /** Crear ciclo */
  @Post()
  create(@Body() dto: CrearCicloDto, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? 0;
    return this.service.create(dto, userId);
  }

  /** Actualizar ciclo */
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CrearCicloDto) {
    return this.service.update(id, dto);
  }

  /** Eliminar ciclo */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  /** Descargar PDF de ciclo guardado */
  @Get(':id/pdf')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response, @Req() req: any) {
    const ciclo  = await this.service.findOne(id);
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
