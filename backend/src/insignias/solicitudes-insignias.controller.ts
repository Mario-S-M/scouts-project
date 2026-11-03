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

/**
 * Prefijo propio para no colisionar con el @Get(':caminanteId') de
 * InsigniasController, que tiene ParseIntPipe.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
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
  ) {}

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
  getSugerencias(@Param('caminanteId', ParseIntPipe) caminanteId: number) {
    return this.solicitudesService.getSugerencias(caminanteId);
  }

  /** Generar PDF sin guardar (preview) */
  @Post('pdf-preview')
  async previewPdf(
    @Body() dto: CrearSolicitudInsigniasDto,
    @Res() res: Response,
    @Req() req: any,
  ) {
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
    @Res() res: Response,
  ) {
    const solicitud = await this.solicitudesService.findOne(id);
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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.solicitudesService.findOne(id);
  }

  /** Alta de una solicitud */
  @Post()
  create(@Body() dto: CrearSolicitudInsigniasDto, @Req() req: any) {
    return this.solicitudesService.create(dto, req.user?.id);
  }

  /** Edición de una solicitud */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarSolicitudInsigniasDto,
  ) {
    return this.solicitudesService.update(id, dto);
  }

  /** Borrado de una solicitud; sus líneas caen por CASCADE */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.solicitudesService.remove(id);
  }
}
