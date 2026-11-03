import { Controller, Get, Post, Patch, Param, Body, ParseIntPipe, UseGuards, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';

/** Roles de scouter que se gestionan aquí; los jóvenes se registran en /caminantes */
const ROLES_STAFF = Object.values(UserRole).filter((r) => r !== UserRole.SCOUT) as string[];

// Ver: administrador y Jefe de Grupo. Crear y editar cuentas: solo el administrador
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMINISTRADOR, UserRole.JEFE_GRUPO)
@Controller('usuarios')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMINISTRADOR)
  create(@Body() dto: CreateUserDto) {
    if (!dto.rol || !ROLES_STAFF.includes(dto.rol)) {
      throw new BadRequestException(`Rol inválido. Opciones: ${ROLES_STAFF.join(', ')}`);
    }
    return this.usersService.create(dto.nombre, dto.email, dto.password, dto.rol);
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRADOR)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    if (dto.rol && !ROLES_STAFF.includes(dto.rol)) {
      throw new BadRequestException(`Rol inválido. Opciones: ${ROLES_STAFF.join(', ')}`);
    }
    return this.usersService.update(id, dto);
  }
}
