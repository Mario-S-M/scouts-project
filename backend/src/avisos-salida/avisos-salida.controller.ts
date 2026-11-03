import { Controller, Post, Get, Put, Delete, Body, Param, Res, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { AvisosSalidaService } from './avisos-salida.service';
import { AvisoSalidaDto } from './dto/aviso-salida.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { ProtocoloTrasladoService } from './protocolo-traslado.service';
import { assertPuedeEditar, assertPuedeVer, seccionDeRol, seccionParaCrearAviso, seccionParaVer } from '../common/rol-seccion.util';

@UseGuards(JwtAuthGuard)
@Controller('avisos-salida')
export class AvisosSalidaController {
  constructor(
    private readonly avisosSalidaService: AvisosSalidaService,
    private readonly usersService: UsersService,
    private readonly protocoloService: ProtocoloTrasladoService,
  ) {}

  /** Personal para dropdowns de contacto */
  @Get('staff')
  async getStaff() {
    const all = await this.usersService.findAll();
    return all
      .filter(u => u.rol !== 'scout')
      .map(u => ({ id: u.id, nombre: u.nombre, rol: u.rol }));
  }

  /** Valores por defecto del protocolo de traslado (coordinador, enlace, transporte) */
  @Get('protocolo/defaults')
  getProtocoloDefaults() {
    return this.protocoloService.defaults();
  }

  /** Avisos visibles para el usuario (su sección; todas para admin y grupo) */
  @Get()
  findAll(@Req() req: any) {
    return this.avisosSalidaService.findAll(seccionParaVer(req.user));
  }

  /** Aviso existente que el usuario puede ver; si no, 403 */
  private async avisoVisible(id: number, req: any) {
    const aviso = await this.avisosSalidaService.findOne(id);
    assertPuedeVer(req.user, aviso.seccion);
    return aviso;
  }

  private async avisoEditable(id: number, req: any) {
    const aviso = await this.avisosSalidaService.findOne(id);
    assertPuedeEditar(req.user, aviso.seccion);
    return aviso;
  }

  /** Guardar aviso */
  @Post()
  async saveAviso(@Body() dto: AvisoSalidaDto, @Req() req: any) {
    const userId   = req.user?.sub ?? req.user?.id ?? 0;
    const userName = req.user?.nombre ?? '';
    const seccion  = seccionParaCrearAviso(req.user, dto.seccion);
    return this.avisosSalidaService.save(dto, userId, userName, seccion);
  }

  /** Descargar PDF de aviso guardado */
  @Get(':id/pdf')
  async getPdfById(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    const aviso  = await this.avisoVisible(id, req);
    const buffer = await this.avisosSalidaService.generatePdf(aviso.data, aviso.seccion);
    const filename = `aviso-salida-${aviso.nombre.replace(/\s+/g, '-')}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  /** Descargar ZIP con permisos de salida individuales (un PDF por participante) */
  @Get(':id/permisos')
  async getPermisosPdf(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    await this.avisoVisible(id, req);
    const { zip, nombre } = await this.avisosSalidaService.generatePermisosZip(id);
    const filename = `permisos-${nombre.replace(/\s+/g, '-')}.zip`;
    res.set({
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      zip.length,
    });
    res.end(zip);
  }

  /** Descargar permiso en blanco con datos de la actividad pero sin datos del joven */
  @Get(':id/permiso-en-blanco')
  async getPermisoEnBlancoPdf(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    const aviso  = await this.avisoVisible(id, req);
    const buffer = await this.avisosSalidaService.generatePermisoEnBlanco(id);
    const filename = `permiso-en-blanco-${aviso.nombre.replace(/\s+/g, '-')}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  /** Protocolo de seguridad en el traslado (formato oficial CNAR, .docx) */
  @Get(':id/protocolo')
  async getProtocolo(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: Response) {
    const aviso  = await this.avisoVisible(id, req);
    const buffer = this.protocoloService.generarDocx(aviso.data);
    const filename = `protocolo-traslado-${aviso.nombre.replace(/\s+/g, '-')}.docx`;
    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  /** Campos obligatorios del protocolo que faltan por llenar */
  @Get(':id/protocolo/faltantes')
  async getProtocoloFaltantes(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const aviso = await this.avisoVisible(id, req);
    return { faltantes: this.protocoloService.faltantes(aviso.data) };
  }

  /** Obtener un aviso por id */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.avisoVisible(id, req);
  }

  /** Actualizar aviso */
  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: AvisoSalidaDto, @Req() req: any) {
    await this.avisoEditable(id, req);
    return this.avisosSalidaService.update(id, dto);
  }

  /** Eliminar aviso */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    await this.avisoEditable(id, req);
    return this.avisosSalidaService.remove(id);
  }

  /** Generar PDF sin guardar */
  @Post('pdf')
  async generatePdf(@Body() dto: AvisoSalidaDto, @Req() req: any, @Res() res: Response) {
    // Vista previa: con la identidad de la sección de quien la genera (o la indicada por el admin)
    const buffer = await this.avisosSalidaService.generatePdf(dto, dto.seccion ?? seccionDeRol(req.user?.rol) ?? 'grupo');
    const filename = `aviso-salida-${(dto.nombre || 'actividad').replace(/\s+/g, '-')}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }
}
