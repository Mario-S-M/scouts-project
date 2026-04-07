import { Controller, Get, Post, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { InsigniasService } from './insignias.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('insignias')
export class InsigniasController {
  constructor(private readonly insigniasService: InsigniasService) {}

  @Get(':caminanteId')
  getInsignias(@Param('caminanteId', ParseIntPipe) caminanteId: number) {
    return this.insigniasService.getInsignias(caminanteId);
  }

  @Post(':caminanteId/calcular')
  calcular(
    @Param('caminanteId', ParseIntPipe) caminanteId: number,
    @Body() body: { validadoPor?: string },
  ) {
    return this.insigniasService.calcularInsignias(
      caminanteId,
      body?.validadoPor,
    );
  }
}
