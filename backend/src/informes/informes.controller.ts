import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Res, Req,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InformesService } from './informes.service';
import { CrearInformeDto, InventarioItemCrudDto } from './dto/informe-mensual.dto';
import { assertPuedeEditar, assertPuedeVer, seccionParaCrear, seccionParaVer } from '../common/rol-seccion.util';

@UseGuards(JwtAuthGuard)
@Controller('informes')
export class InformesController {
  constructor(private readonly svc: InformesService) {}

  // ── Informes ────────────────────────────────────────────────────────────────
  @Get()
  findAll(@Req() req: any) { return this.svc.findAll(seccionParaVer(req.user)); }

  private async verInforme(id: number, req: any) {
    assertPuedeVer(req.user, await this.svc.seccionDeInforme(id));
  }
  private async editarInforme(id: number, req: any) {
    assertPuedeEditar(req.user, await this.svc.seccionDeInforme(id));
  }

  /** Último informe de una sección (para pre-cargar datos en nuevo informe) */
  @Get('ultimo/:seccion')
  findUltimo(@Param('seccion') seccion: string, @Req() req: any) {
    assertPuedeVer(req.user, seccion);
    return this.svc.findUltimo(seccion);
  }

  /** Catálogo de especialidades disponibles para progresión */
  @Get('catalogo/progresion')
  getCatalogoProgresion() {
    return this.svc.getEspecialidadesCatalogo();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.verInforme(id, req);
    return this.svc.findOne(id);
  }

  @Post()
  create(@Body() dto: CrearInformeDto, @Req() req: any) {
    dto.seccion = seccionParaCrear(req.user, dto.seccion);
    return this.svc.create(dto, req.user?.sub ?? req.user?.id ?? 0);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: CrearInformeDto, @Req() req: any) {
    await this.editarInforme(id, req);
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.editarInforme(id, req);
    return this.svc.remove(id);
  }

  // ── Partial updates (auto-save por tab) ─────────────────────────────────────
  @Patch(':id/config')
  async updateConfig(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    await this.editarInforme(id, req);
    return this.svc.updateConfig(id, body);
  }

  @Patch(':id/membresia')
  async updateMembresia(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    await this.editarInforme(id, req);
    return this.svc.updateMembresia(id, body);
  }

  @Patch(':id/actividades')
  async updateActividades(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    await this.editarInforme(id, req);
    return this.svc.updateActividades(id, body);
  }

  @Patch(':id/financiero')
  async updateFinanciero(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    await this.editarInforme(id, req);
    return this.svc.updateFinanciero(id, body);
  }

  @Patch(':id/progresion')
  async updateProgresion(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req: any) {
    await this.editarInforme(id, req);
    return this.svc.updateProgresion(id, body);
  }

  /** Agrega a Progresión las solicitudes de insignias del mes de la sección */
  @Post(':id/importar-solicitudes-insignias')
  async importarSolicitudesInsignias(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.editarInforme(id, req);
    return this.svc.importarSolicitudesInsignias(id);
  }

  /** PDF con todos los informes mensuales de una sección en un año */
  @Get('anual/:seccion/:anio/pdf')
  async getPdfAnual(
    @Param('seccion') seccion: string,
    @Param('anio', ParseIntPipe) anio: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    assertPuedeVer(req.user, seccion);
    const buffer = await this.svc.generatePdfAnual(seccion, anio);
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="informe-anual-${seccion}-${anio}.pdf"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id/pdf')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    await this.verInforme(id, req);
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
  getInventario(@Param('seccion') seccion: string, @Req() req: any) {
    assertPuedeVer(req.user, seccion);
    return this.svc.getInventario(seccion);
  }

  @Post('inventario')
  createItem(@Body() dto: InventarioItemCrudDto, @Req() req: any) {
    dto.seccion = seccionParaCrear(req.user, dto.seccion);
    return this.svc.createInventarioItem(dto);
  }

  @Put('inventario/:id')
  async updateItem(@Param('id', ParseIntPipe) id: number, @Body() dto: InventarioItemCrudDto, @Req() req: any) {
    assertPuedeEditar(req.user, await this.svc.seccionDeInventario(id));
    return this.svc.updateInventarioItem(id, dto);
  }

  @Delete('inventario/:id')
  async removeItem(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    assertPuedeEditar(req.user, await this.svc.seccionDeInventario(id));
    return this.svc.removeInventarioItem(id);
  }
}
