import { Controller, Get, Post, Param, Body, ParseIntPipe, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InsigniasService } from './insignias.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { assertPuedeEditar, assertPuedeVer } from '../common/rol-seccion.util';
import { seccionDeCaminante } from '../common/seccion-de-caminante';

@UseGuards(JwtAuthGuard)
@Controller('insignias')
export class InsigniasController {
  constructor(
    private readonly insigniasService: InsigniasService,
    private readonly ds: DataSource,
  ) {}

  @Get(':caminanteId')
  async getInsignias(@Param('caminanteId', ParseIntPipe) caminanteId: number, @Req() req: any) {
    // El joven ve las suyas; los scouters, las de su sección
    if (req.user?.rol === 'scout') {
      if (req.user.id !== caminanteId) throw new ForbiddenException('Solo puedes ver tus insignias');
    } else {
      assertPuedeVer(req.user, await seccionDeCaminante(this.ds, caminanteId));
    }
    return this.insigniasService.getInsignias(caminanteId);
  }

  @Post(':caminanteId/calcular')
  async calcular(
    @Param('caminanteId', ParseIntPipe) caminanteId: number,
    @Body() body: { validadoPor?: string },
    @Req() req: any,
  ) {
    assertPuedeEditar(req.user, await seccionDeCaminante(this.ds, caminanteId));
    return this.insigniasService.calcularInsignias(
      caminanteId,
      body?.validadoPor,
    );
  }
}
