import { Controller, Get, Put, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfiguracionRecordatorioService } from './configuracion-recordatorio.service';
import { ActualizarConfiguracionRecordatorioDto } from './dto/configuracion-recordatorio.dto';
import { SeccionActividad } from './entities/actividad.entity';

@UseGuards(JwtAuthGuard)
@Controller('configuracion-recordatorios')
export class ConfiguracionRecordatorioController {
  constructor(private readonly service: ConfiguracionRecordatorioService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Put(':seccion')
  update(
    @Param('seccion') seccion: SeccionActividad,
    @Body() dto: ActualizarConfiguracionRecordatorioDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ?? req.user?.id ?? 0;
    return this.service.update(seccion, dto, userId, req.user?.rol);
  }
}
