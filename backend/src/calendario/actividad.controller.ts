import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Req,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActividadService } from './actividad.service';
import { CrearActividadDto, ActualizarActividadDto } from './dto/actividad.dto';

@UseGuards(JwtAuthGuard)
@Controller('calendario')
export class ActividadController {
  constructor(private readonly service: ActividadService) {}

  /** Todas las actividades son visibles para cualquier usuario autenticado */
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('mes/:anio/:mes')
  findByMes(
    @Param('anio', ParseIntPipe) anio: number,
    @Param('mes', ParseIntPipe) mes: number,
  ) {
    return this.service.findByMes(anio, mes);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
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
