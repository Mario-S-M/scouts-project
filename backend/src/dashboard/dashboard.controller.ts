import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getSeccionFromRol } from '../common/rol-seccion.util';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@Request() req) {
    const seccion = getSeccionFromRol(req.user.rol);
    return this.dashboardService.getStats(seccion);
  }
}
