import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Req,
  UseGuards, ParseIntPipe, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActividadService } from './actividad.service';
import { CrearActividadDto, ActualizarActividadDto, CrearActividadesLoteDto, NotificarActividadesDto } from './dto/actividad.dto';
import { RecordatoriosService } from './recordatorios.service';

@UseGuards(JwtAuthGuard)
@Controller('calendario')
export class ActividadController {
  constructor(
    private readonly service: ActividadService,
    private readonly recordatorios: RecordatoriosService,
  ) {}

  /**
   * Los scouters ven todo; los jóvenes, las públicas y las de su sección
   * (nunca las "solo scouters"). Ver ActividadService.visiblePara.
   */
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user);
  }

  @Get('mes/:anio/:mes')
  findByMes(
    @Param('anio', ParseIntPipe) anio: number,
    @Param('mes', ParseIntPipe) mes: number,
    @Req() req: any,
  ) {
    return this.service.findByMes(anio, mes, req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user);
  }

  /** Varias actividades a la vez (las confirmadas tras una reunión) */
  @Post('lote')
  createLote(@Body() dto: CrearActividadesLoteDto, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? 0;
    return this.service.createLote(dto.actividades, userId, req.user?.rol);
  }

  /** Manda por Telegram a cada scouter las actividades indicadas que le tocan */
  @Post('notificar')
  notificar(@Body() dto: NotificarActividadesDto, @Req() req: any) {
    if (req.user?.rol === 'scout') throw new ForbiddenException();
    return this.recordatorios.notificarScouters(dto.ids);
  }

  /** Scouters que todavía no vinculan Telegram */
  @Get('telegram/pendientes')
  pendientesTelegram(@Req() req: any) {
    if (req.user?.rol === 'scout') throw new ForbiddenException();
    return this.recordatorios.scoutersSinTelegram();
  }

  @Post()
  create(@Body() dto: CrearActividadDto, @Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? 0;
    return this.service.create(dto, userId, req.user?.rol);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarActividadDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req.user?.rol);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user?.rol);
  }
}
