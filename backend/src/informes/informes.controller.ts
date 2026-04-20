import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Res, Req,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InformesService } from './informes.service';
import { CrearInformeDto, InventarioItemCrudDto } from './dto/informe-mensual.dto';

@UseGuards(JwtAuthGuard)
@Controller('informes')
export class InformesController {
  constructor(private readonly svc: InformesService) {}

  // ── Informes ────────────────────────────────────────────────────────────────
  @Get()
  findAll() { return this.svc.findAll(); }

  /** Último informe de una sección (para pre-cargar datos en nuevo informe) */
  @Get('ultimo/:seccion')
  findUltimo(@Param('seccion') seccion: string) {
    return this.svc.findUltimo(seccion);
  }

  /** Catálogo de especialidades disponibles para progresión */
  @Get('catalogo/progresion')
  getCatalogoProgresion() {
    return this.svc.getEspecialidadesCatalogo();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: CrearInformeDto, @Req() req: any) {
    return this.svc.create(dto, req.user?.sub ?? req.user?.id ?? 0);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CrearInformeDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }

  // ── Partial updates (auto-save por tab) ─────────────────────────────────────
  @Patch(':id/config')
  updateConfig(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.updateConfig(id, body);
  }

  @Patch(':id/membresia')
  updateMembresia(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.updateMembresia(id, body);
  }

  @Patch(':id/actividades')
  updateActividades(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.updateActividades(id, body);
  }

  @Patch(':id/financiero')
  updateFinanciero(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.updateFinanciero(id, body);
  }

  @Patch(':id/progresion')
  updateProgresion(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.updateProgresion(id, body);
  }

  @Get(':id/pdf')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const informe    = await this.svc.findOne(id);
    const inventario = await this.svc.getInventario(informe.seccion);
    const personas   = await this.svc.getPersonasSeccion(informe.seccion);
    const buffer     = await this.svc.generatePdf(informe, inventario, personas);
    const nombre    = `informe-${informe.seccion}-${informe.anio}-${String(informe.mes).padStart(2,'0')}`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${nombre}.pdf"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  // ── Inventario ──────────────────────────────────────────────────────────────
  @Get('inventario/:seccion')
  getInventario(@Param('seccion') seccion: string) {
    return this.svc.getInventario(seccion);
  }

  @Post('inventario')
  createItem(@Body() dto: InventarioItemCrudDto) {
    return this.svc.createInventarioItem(dto);
  }

  @Put('inventario/:id')
  updateItem(@Param('id', ParseIntPipe) id: number, @Body() dto: InventarioItemCrudDto) {
    return this.svc.updateInventarioItem(id, dto);
  }

  @Delete('inventario/:id')
  removeItem(@Param('id', ParseIntPipe) id: number) {
    return this.svc.removeInventarioItem(id);
  }
}
