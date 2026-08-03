import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Actividad, SeccionActividad } from './entities/actividad.entity';
import { CrearActividadDto } from './dto/actividad.dto';
import { getSeccionFromRol } from '../common/rol-seccion.util';

const ADMIN_ROLES = ['jefe_grupo', 'sub_jefe_grupo'];

/** Determina si un rol puede crear/editar/borrar actividades de una sección dada. */
export function puedeGestionarSeccion(rol: string, seccion: string): boolean {
  if (ADMIN_ROLES.includes(rol)) return true;
  const seccionDelRol = getSeccionFromRol(rol);
  return seccionDelRol !== null && seccionDelRol === seccion;
}

@Injectable()
export class ActividadService {
  constructor(
    @InjectRepository(Actividad)
    private actividadRepo: Repository<Actividad>,
  ) {}

  findAll(): Promise<Actividad[]> {
    return this.actividadRepo.find({ order: { fecha: 'ASC', hora: 'ASC' } });
  }

  async findByMes(anio: number, mes: number): Promise<Actividad[]> {
    const prefix = `${anio}-${String(mes).padStart(2, '0')}`;
    const todas = await this.actividadRepo.find({ order: { fecha: 'ASC', hora: 'ASC' } });
    return todas.filter((a) => a.fecha.startsWith(prefix));
  }

  async findOne(id: number): Promise<Actividad> {
    const actividad = await this.actividadRepo.findOne({ where: { id } });
    if (!actividad) throw new NotFoundException(`Actividad #${id} no encontrada`);
    return actividad;
  }

  /** Actividades de una sección dentro de los próximos `dias` días (inclusive de hoy). */
  async findProximas(seccion: SeccionActividad, dias: number): Promise<Actividad[]> {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + dias);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return this.actividadRepo.find({
      where: { seccion, fecha: Between(fmt(hoy), fmt(limite)) },
      order: { fecha: 'ASC', hora: 'ASC' },
    });
  }

  create(dto: CrearActividadDto, userId: number, rol: string): Promise<Actividad> {
    this.verificarPermiso(rol, dto.seccion);
    const actividad = this.actividadRepo.create({ ...dto, creadoPorId: userId });
    return this.actividadRepo.save(actividad);
  }

  async update(id: number, dto: CrearActividadDto, rol: string): Promise<Actividad> {
    const actividad = await this.findOne(id);
    this.verificarPermiso(rol, actividad.seccion);
    this.verificarPermiso(rol, dto.seccion);
    Object.assign(actividad, dto);
    return this.actividadRepo.save(actividad);
  }

  async remove(id: number, rol: string): Promise<void> {
    const actividad = await this.findOne(id);
    this.verificarPermiso(rol, actividad.seccion);
    await this.actividadRepo.delete(id);
  }

  private verificarPermiso(rol: string, seccion: string): void {
    if (!puedeGestionarSeccion(rol, seccion)) {
      throw new ForbiddenException('No tienes permiso para gestionar actividades de esta sección');
    }
  }
}
