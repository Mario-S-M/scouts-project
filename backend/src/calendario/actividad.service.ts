import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Actividad, SeccionActividad, TipoActividad, Visibilidad } from './entities/actividad.entity';
import { CrearActividadDto } from './dto/actividad.dto';
import { User } from '../users/entities/user.entity';
import { esAdmin, esGrupo, seccionDeRol, JEFATURA_GRUPO, UsuarioToken } from '../common/rol-seccion.util';

/** Secciones efectivas de una actividad (las viejas solo tenían `seccion`) */
export function seccionesDe(a: Pick<Actividad, 'seccion' | 'secciones'>): string[] {
  if (a.secciones?.length) return a.secciones;
  return [a.seccion === 'general' ? 'grupo' : a.seccion];
}

/**
 * Quién crea/edita/borra una actividad (y configura recordatorios):
 * - administrador: todas
 * - jefatura de grupo: las de todo el grupo
 * - scouter de sección: las que son solo de su sección
 * Las de varias secciones las registra el administrador o la jefatura de grupo.
 */
export function puedeGestionar(rol: string, secciones: string[]): boolean {
  if (esAdmin(rol)) return true;
  if (JEFATURA_GRUPO.includes(rol)) return secciones.includes('grupo');
  const propia = seccionDeRol(rol);
  return !!propia && secciones.length > 0 && secciones.every((s) => s === propia);
}

/** Compatibilidad: recordatorios por sección ('general' = grupo) */
export function puedeGestionarSeccion(rol: string, seccion: string): boolean {
  return puedeGestionar(rol, [seccion === 'general' ? 'grupo' : seccion]);
}

@Injectable()
export class ActividadService {
  constructor(
    @InjectRepository(Actividad)
    private actividadRepo: Repository<Actividad>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  /** Actividades anteriores a tipos/visibilidad/varias secciones; idempotente */
  async completarCamposNuevos(): Promise<void> {
    await this.actividadRepo.query(`
      UPDATE actividades_calendario
         SET secciones = CASE WHEN seccion = 'general' THEN 'grupo' ELSE seccion END
       WHERE secciones IS NULL OR secciones = ''`);
  }

  /**
   * ¿Puede este usuario ver la actividad?
   * - scouters (y administración): todas, incluidas las "solo scouters"
   * - jóvenes: las públicas, y las "de sección" si son de su sección o de todo el grupo
   */
  private visiblePara(a: Actividad, rol: string, seccionJoven: string | null): boolean {
    if (rol !== 'scout') return true;
    if (a.visibilidad === 'scouters') return false;
    if (a.visibilidad === 'seccion') {
      const secs = seccionesDe(a);
      return secs.includes('grupo') || (!!seccionJoven && secs.includes(seccionJoven));
    }
    return true;
  }

  private async filtrarVisibles(lista: Actividad[], user: UsuarioToken): Promise<Actividad[]> {
    let seccionJoven: string | null = null;
    if (user?.rol === 'scout') {
      seccionJoven = (await this.usersRepo.findOne({ where: { id: user.id }, select: ['id', 'seccion'] }))?.seccion ?? null;
    }
    return lista
      .filter((a) => this.visiblePara(a, user?.rol, seccionJoven))
      .map((a) => ({ ...a, secciones: seccionesDe(a) }));
  }

  async findAll(user: UsuarioToken): Promise<Actividad[]> {
    return this.filtrarVisibles(await this.actividadRepo.find({ order: { fecha: 'ASC', hora: 'ASC' } }), user);
  }

  async findByMes(anio: number, mes: number, user: UsuarioToken): Promise<Actividad[]> {
    const prefix = `${anio}-${String(mes).padStart(2, '0')}`;
    const todas = await this.actividadRepo.find({ order: { fecha: 'ASC', hora: 'ASC' } });
    return this.filtrarVisibles(todas.filter((a) => a.fecha.startsWith(prefix)), user);
  }

  async findOne(id: number, user?: UsuarioToken): Promise<Actividad> {
    const actividad = await this.actividadRepo.findOne({ where: { id } });
    if (!actividad) throw new NotFoundException(`Actividad #${id} no encontrada`);
    if (user && !(await this.filtrarVisibles([actividad], user)).length) {
      throw new NotFoundException(`Actividad #${id} no encontrada`);
    }
    return { ...actividad, secciones: seccionesDe(actividad) };
  }

  /**
   * Actividades de una sección en los próximos `dias` días (incluye las de todo
   * el grupo). `paraJovenes` quita las "solo scouters".
   */
  async findProximas(seccion: SeccionActividad, dias: number, paraJovenes = false): Promise<Actividad[]> {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + dias);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const ventana = await this.actividadRepo.find({
      where: { fecha: Between(fmt(hoy), fmt(limite)) },
      order: { fecha: 'ASC', hora: 'ASC' },
    });
    const clave = seccion === 'general' ? 'grupo' : seccion;
    return ventana.filter((a) => {
      const secs = seccionesDe(a);
      const toca = clave === 'grupo' ? secs.includes('grupo') : secs.includes(clave) || secs.includes('grupo');
      return toca && !(paraJovenes && a.visibilidad === 'scouters');
    });
  }

  /** Valores por defecto y campo de compatibilidad `seccion` */
  private normalizar(dto: CrearActividadDto): Partial<Actividad> {
    const secciones = dto.secciones?.length
      ? [...new Set(dto.secciones)]
      : dto.seccion ? [dto.seccion === 'general' ? 'grupo' : dto.seccion] : null;
    if (!secciones) throw new BadRequestException('Indica las secciones de la actividad (o "grupo")');
    const unicas = secciones.includes('grupo') ? ['grupo'] : secciones;
    const tipo: TipoActividad = dto.tipo ?? 'reunion';
    const visibilidad: Visibilidad = dto.visibilidad ?? (tipo === 'consejo' ? 'scouters' : 'publica');
    const { seccion: _ignorada, ...resto } = dto;
    return {
      ...resto,
      secciones: unicas,
      seccion: (unicas.length === 1 && unicas[0] !== 'grupo' ? unicas[0] : 'general') as SeccionActividad,
      tipo,
      visibilidad,
    };
  }

  create(dto: CrearActividadDto, userId: number, rol: string): Promise<Actividad> {
    const datos = this.normalizar(dto);
    this.verificarPermiso(rol, datos.secciones!);
    return this.actividadRepo.save(this.actividadRepo.create({ ...datos, creadoPorId: userId }));
  }

  /** Alta en lote: se valida todo antes de guardar nada */
  async createLote(dtos: CrearActividadDto[], userId: number, rol: string): Promise<Actividad[]> {
    const datos = dtos.map((d) => this.normalizar(d));
    datos.forEach((d) => this.verificarPermiso(rol, d.secciones!));
    return this.actividadRepo.save(datos.map((d) => this.actividadRepo.create({ ...d, creadoPorId: userId })));
  }

  async update(id: number, dto: CrearActividadDto, rol: string): Promise<Actividad> {
    const actividad = await this.actividadRepo.findOne({ where: { id } });
    if (!actividad) throw new NotFoundException(`Actividad #${id} no encontrada`);
    this.verificarPermiso(rol, seccionesDe(actividad));
    const datos = this.normalizar({
      ...dto,
      secciones: dto.secciones ?? (dto.seccion ? undefined : seccionesDe(actividad)),
      tipo: dto.tipo ?? actividad.tipo,
      visibilidad: dto.visibilidad ?? actividad.visibilidad,
    });
    this.verificarPermiso(rol, datos.secciones!);
    Object.assign(actividad, datos);
    return this.actividadRepo.save(actividad);
  }

  async remove(id: number, rol: string): Promise<void> {
    const actividad = await this.actividadRepo.findOne({ where: { id } });
    if (!actividad) throw new NotFoundException(`Actividad #${id} no encontrada`);
    this.verificarPermiso(rol, seccionesDe(actividad));
    await this.actividadRepo.delete(id);
  }

  findByIds(ids: number[]): Promise<Actividad[]> {
    return this.actividadRepo.find({ where: { id: In(ids) }, order: { fecha: 'ASC', hora: 'ASC' } });
  }

  private verificarPermiso(rol: string, secciones: string[]): void {
    if (!puedeGestionar(rol, secciones)) {
      throw new ForbiddenException(
        esGrupo(rol)
          ? 'La jefatura de grupo registra actividades de todo el grupo; las de una sección las registra su scouter'
          : 'Solo puedes registrar actividades de tu sección; las de varias secciones las registra el administrador o la jefatura de grupo',
      );
    }
  }
}
