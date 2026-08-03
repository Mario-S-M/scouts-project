import { Controller, Get, Post, Delete, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TelegramService } from './telegram.service';

@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private readonly service: TelegramService) {}

  @Get('estado')
  estado(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? 0;
    return this.service.estado(userId);
  }

  @Post('vincular')
  vincular(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? 0;
    return this.service.generarCodigoVinculacion(userId);
  }

  @Delete('vincular')
  desvincular(@Req() req: any) {
    const userId = req.user?.sub ?? req.user?.id ?? 0;
    return this.service.desvincular(userId);
  }
}
