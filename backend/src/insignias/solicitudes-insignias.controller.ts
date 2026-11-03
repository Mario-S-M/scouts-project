import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  Res,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { SolicitudesInsigniasService } from './solicitudes-insignias.service';
import { SolicitudesPdfService } from './solicitudes-pdf.service';
import {
  CrearSolicitudInsigniasDto,
  ActualizarSolicitudInsigniasDto,
} from './dto/solicitud-insignias.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { DataSource } from 'typeorm';
import { assertPuedeEditar, assertPuedeVer } from '../common/rol-seccion.util';
import { seccionDeCaminante } from '../common/seccion-de-caminante';

/**
 * Prefijo propio para no colisionar con el @Get(':caminanteId') de
 * InsigniasController, que tiene ParseIntPipe.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.ADMINISTRADOR,
  UserRole.JEFE_GRUPO,
  UserRole.JEFE_MANADA,
  UserRole.SUB_JEFE_MANADA,
  UserRole.JEFE_TROPA,
  UserRole.SUB_JEFE_TROPA,
  UserRole.JEFE_COMUNIDAD,
  UserRole.SUB_JEFE_COMUNIDAD,
  UserRole.JEFE_CLAN,
  UserRole.SUB_JEFE_CLAN,
)
@Controller('insignias/solicitudes')
export class SolicitudesInsigniasController {
  constructor(
    private readonly solicitudesService: SolicitudesInsigniasService,
    private readonly pdfService: SolicitudesPdfService,
    private readonly ds: DataSource,
  ) {}

  private async solicitudVisible(id: number, req: any) {
    const solicitud = await this.solicitudesService.findOne(id);
    assertPuedeVer(req.user, solicitud.seccion);
    return solicitud;
  }

  /** Listado, filtrado por sección salvo para los roles de grupo */
  @Get()
  findAll(@Req() req: any) {
    return this.solicitudesService.findAll(req.user?.rol);
  }

  /**
   * Ítems del catálogo que el caminante ya tiene ganados.
   * Se declara ANTES de ':id' para que la ruta no caiga en el parámetro.
   */
  @Get('sugerencias/:caminanteId')
  async getSugerencias(@Param('caminanteId', ParseIntPipe) caminanteId: number, @Req() req: any) {
    assertPuedeVer(req.user, await seccionDeCaminante(this.ds, caminanteId));
    return this.solicitudesService.getSugerencias(caminanteId);
  }

  /** Generar PDF sin guardar (preview) */
  @Post('pdf-preview')
  async previewPdf(
    @Body() dto: CrearSolicitudInsigniasDto,
    @Res() res: Response,
    @Req() req: any,
  ) {
    assertPuedeVer(req.user, await seccionDeCaminante(this.ds, dto.caminanteId));
    // Se arma una solicitud temporal desde el DTO, sin persistirla
    const temporal = await this.solicitudesService.armarTemporal(
      dto,
      req.user?.id,
    );
    const buffer = await this.pdfService.generatePdf(temporal);
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="solicitud-insignias-borrador.pdf"',
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  /** Descargar el PDF de una solicitud guardada */
  @Get(':id/pdf')
  async descargarPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const solicitud = await this.solicitudVisible(id, req);
    const buffer = await this.pdfService.generatePdf(solicitud);
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="solicitud-insignias-${id}.pdf"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  /** Detalle de una solicitud con sus líneas */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.solicitudVisible(id, req);
  }

  /** Alta de una solicitud */
  @Post()
  async create(@Body() dto: CrearSolicitudInsigniasDto, @Req() req: any) {
    assertPuedeEditar(req.user, await seccionDeCaminante(this.ds, dto.caminanteId));
    return this.solicitudesService.create(dto, req.user?.id);
  }

  /** Edición de una solicitud */
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarSolicitudInsigniasDto,
    @Req() req: any,
  ) {
    assertPuedeEditar(req.user, (await this.solicitudesService.findOne(id)).seccion);
    if (dto.caminanteId) assertPuedeEditar(req.user, await seccionDeCaminante(this.ds, dto.caminanteId));
    return this.solicitudesService.update(id, dto);
  }

  /** Borrado de una solicitud; sus líneas caen por CASCADE */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    assertPuedeEditar(req.user, (await this.solicitudesService.findOne(id)).seccion);
    return this.solicitudesService.remove(id);
  }
}
