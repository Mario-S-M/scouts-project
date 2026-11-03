import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CatalogoInsigniasService } from './catalogo-insignias.service';
import {
  CrearCatalogoInsigniaDto,
  ActualizarCatalogoInsigniaDto,
} from './dto/catalogo-insignia.dto';
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
@Controller('insignias/catalogo')
export class CatalogoInsigniasController {
  constructor(private readonly catalogoService: CatalogoInsigniasService) {}

  /**
   * Lista los ítems del catálogo. Por defecto solo los activos;
   * con `?incluirInactivos=true` devuelve también los dados de baja.
   */
  @Get()
  findAll(
    @Query('incluirInactivos') incluirInactivos?: string,
    @Query('soloActivos') soloActivos?: string,
  ) {
    const incluir = incluirInactivos === 'true' || soloActivos === 'false';
    return this.catalogoService.findAll(!incluir);
  }

  /** Alta de un ítem */
  @Post()
  create(@Body() dto: CrearCatalogoInsigniaDto) {
    return this.catalogoService.create(dto);
  }

  /** Edición de un ítem */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCatalogoInsigniaDto,
  ) {
    return this.catalogoService.update(id, dto);
  }

  /** Borrado lógico: deja la fila con activo = false */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.remove(id);
  }
}
