import { Controller, Post, Param, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecordatoriosService } from './recordatorios.service';
import { SeccionActividad } from './entities/actividad.entity';

@UseGuards(JwtAuthGuard)
@Controller('calendario/recordatorios')
export class RecordatoriosController {
  constructor(private readonly service: RecordatoriosService) {}

  /** Dispara manualmente el envío del recordatorio de una sección (solo jefe_grupo). Útil para probar. */
  @Post('probar/:seccion')
  async probar(@Param('seccion') seccion: SeccionActividad, @Req() req: any) {
    if (req.user?.rol !== 'jefe_grupo') {
      throw new ForbiddenException('Solo el jefe de grupo puede probar el envío de recordatorios');
    }
    await this.service.enviarRecordatorio(seccion);
    return { ok: true };
  }
}
