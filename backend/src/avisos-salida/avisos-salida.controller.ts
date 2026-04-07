import { Controller, Post, Get, Put, Delete, Body, Param, Res, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { AvisosSalidaService } from './avisos-salida.service';
import { AvisoSalidaDto } from './dto/aviso-salida.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';

@UseGuards(JwtAuthGuard)
@Controller('avisos-salida')
export class AvisosSalidaController {
  constructor(
    private readonly avisosSalidaService: AvisosSalidaService,
    private readonly usersService: UsersService,
  ) {}

  /** Personal para dropdowns de contacto */
  @Get('staff')
  async getStaff() {
    const all = await this.usersService.findAll();
    return all
      .filter(u => u.rol !== 'scout')
      .map(u => ({ id: u.id, nombre: u.nombre, rol: u.rol }));
  }

  /** Listar todos los avisos guardados */
  @Get()
  findAll() {
    return this.avisosSalidaService.findAll();
  }

  /** Guardar aviso */
  @Post()
  async saveAviso(@Body() dto: AvisoSalidaDto, @Req() req: any) {
    const userId   = req.user?.sub ?? req.user?.id ?? 0;
    const userName = req.user?.nombre ?? '';
    return this.avisosSalidaService.save(dto, userId, userName);
  }

  /** Descargar PDF de aviso guardado */
  @Get(':id/pdf')
  async getPdfById(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const aviso  = await this.avisosSalidaService.findOne(id);
    const buffer = await this.avisosSalidaService.generatePdf(aviso.data);
    const filename = `aviso-salida-${aviso.nombre.replace(/\s+/g, '-')}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }

  /** Obtener un aviso por id */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.avisosSalidaService.findOne(id);
  }

  /** Actualizar aviso */
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: AvisoSalidaDto) {
    return this.avisosSalidaService.update(id, dto);
  }

  /** Eliminar aviso */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.avisosSalidaService.remove(id);
  }

  /** Generar PDF sin guardar */
  @Post('pdf')
  async generatePdf(@Body() dto: AvisoSalidaDto, @Res() res: Response) {
    const buffer = await this.avisosSalidaService.generatePdf(dto);
    const filename = `aviso-salida-${(dto.nombre || 'actividad').replace(/\s+/g, '-')}.pdf`;
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
    });
    res.end(buffer);
  }
}
