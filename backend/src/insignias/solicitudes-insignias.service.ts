import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SolicitudInsignias } from './entities/solicitud-insignias.entity';
import {
  SolicitudInsigniasLinea,
  COMPONENTE_KIT_OBLIGATORIO,
} from './entities/solicitud-insignias-linea.entity';
import { CatalogoInsignia } from './entities/catalogo-insignia.entity';
import { Insignia } from './entities/insignia.entity';
import { User } from '../users/entities/user.entity';
import { SenderoProgreso } from '../progreso/entities/sendero-progreso.entity';
import {
  CrearSolicitudInsigniasDto,
  ActualizarSolicitudInsigniasDto,
  LineaSolicitudInsigniasDto,
} from './dto/solicitud-insignias.dto';
import { getSeccionFromRol } from '../common/rol-seccion.util';

/** Relaciones que se cargan siempre que se devuelve una solicitud completa */
const RELACIONES_SOLICITUD = [
  'caminante',
  'solicitante',
  'lineas',
  'lineas.catalogoItem',
];

/** Un sendero se considera completo con 5 o más caminos completados */
const CAMINOS_PARA_SENDERO_COMPLETO = 5;

@Injectable()
export class SolicitudesInsigniasService {
  constructor(
    @InjectRepository(SolicitudInsignias)
    private solicitudRepo: Repository<SolicitudInsignias>,
    @InjectRepository(SolicitudInsigniasLinea)
    private lineaRepo: Repository<SolicitudInsigniasLinea>,
    @InjectRepository(CatalogoInsignia)
    private catalogoRepo: Repository<CatalogoInsignia>,
    @InjectRepository(Insignia)
    private insigniaRepo: Repository<Insignia>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(SenderoProgreso)
    private senderoRepo: Repository<SenderoProgreso>,
  ) {}

  /**
   * Lista las solicitudes. Los roles de sección solo ven las de su sección;
   * los roles de grupo las ven todas (getSeccionFromRol devuelve null).
   */
  async findAll(rol: string): Promise<SolicitudInsignias[]> {
    // El mapa rol → sección vive en common/rol-seccion.util.ts; no se duplica aquí
    const seccion = getSeccionFromRol(rol);

    return this.solicitudRepo.find({
      where: seccion ? { seccion } : {},
      relations: RELACIONES_SOLICITUD,
      order: { fecha: 'DESC', id: 'DESC' },
    });
  }

  /** Devuelve una solicitud con sus líneas */
  async findOne(id: number): Promise<SolicitudInsignias> {
    const solicitud = await this.solicitudRepo.findOne({
      where: { id },
      relations: RELACIONES_SOLICITUD,
    });
    if (!solicitud) {
      throw new NotFoundException(`No existe la solicitud ${id}`);
    }
    return solicitud;
  }

  /**
   * Alta de una solicitud. `seccion` se copia de caminante.seccion y
   * `solicitanteId` viene de req.user.id.
   */
  async create(
    dto: CrearSolicitudInsigniasDto,
    solicitanteId: number,
  ): Promise<SolicitudInsignias> {
    const { solicitud } = await this.construir(dto, solicitanteId);

    const guardada = await this.solicitudRepo.save(solicitud);

    // Se relee para devolverla con caminante, solicitante y catalogoItem cargados
    return this.findOne(guardada.id);
  }

  /** Edición de una solicitud; reemplaza sus líneas */
  async update(
    id: number,
    dto: ActualizarSolicitudInsigniasDto,
  ): Promise<SolicitudInsignias> {
    const solicitud = await this.findOne(id);

    // Si cambia el caminante se vuelve a copiar su sección
    if (dto.caminanteId !== undefined && dto.caminanteId !== solicitud.caminanteId) {
      const caminante = await this.buscarCaminante(dto.caminanteId);
      solicitud.caminanteId = caminante.id;
      solicitud.seccion = caminante.seccion;
    }

    if (dto.fecha !== undefined) {
      // La fecha llega como 'YYYY-MM-DD'; se pasa tal cual para no desplazarla de día
      solicitud.fecha = dto.fecha as unknown as Date;
    }
    if (dto.observaciones !== undefined) {
      solicitud.observaciones = dto.observaciones;
    }

    if (dto.lineas !== undefined) {
      const lineas = await this.construirLineas(dto.lineas);
      // Las líneas viejas se borran explícitamente: el cascade de insert no
      // elimina las huérfanas por sí solo
      await this.lineaRepo.delete({ solicitudId: id });
      solicitud.lineas = lineas;
    }

    await this.solicitudRepo.save(solicitud);
    return this.findOne(id);
  }

  /** Borra la solicitud; sus líneas caen por CASCADE */
  async remove(id: number): Promise<void> {
    await this.findOne(id); // lanza 404 si no existe
    await this.solicitudRepo.delete(id);
  }

  /**
   * Arma una solicitud en memoria a partir del DTO, sin guardarla, para el
   * preview del PDF. Debe hidratar caminante, solicitante y el catalogoItem de
   * cada línea, porque el PDF los necesita para agrupar por categoría.
   */
  async armarTemporal(
    dto: CrearSolicitudInsigniasDto,
    solicitanteId: number,
  ): Promise<SolicitudInsignias> {
    const { solicitud, caminante } = await this.construir(dto, solicitanteId);

    // Nada de esto se persiste: solo se hidrata para que el PDF tenga los datos
    solicitud.caminante = caminante;
    solicitud.solicitante = await this.userRepo.findOne({
      where: { id: solicitanteId },
    });

    return solicitud;
  }

  /**
   * Devuelve los ids del catálogo que el caminante ya tiene ganados según su
   * progreso registrado. Cintas, cordón y kit nunca se sugieren.
   */
  async getSugerencias(caminanteId: number): Promise<number[]> {
    const claves = new Set<string>();

    // Progresión: insignias otorgadas, empatando `tipo` contra `claveProgreso`
    const insignias = await this.insigniaRepo.find({
      where: { caminanteId, otorgada: true },
    });
    for (const insignia of insignias) {
      claves.add(insignia.tipo);
    }

    // Senderos y ejes: un sendero cuenta como completo con 5 o más caminos
    // completados, la misma regla de countSenderosCompletos en insignias.service.ts
    const senderos = await this.senderoRepo.find({ where: { caminanteId } });
    const completadosPorSendero = new Map<string, number>();
    for (const fila of senderos) {
      if (!fila.completado) continue;
      completadosPorSendero.set(
        fila.sendero,
        (completadosPorSendero.get(fila.sendero) ?? 0) + 1,
      );
    }
    for (const [sendero, completados] of completadosPorSendero) {
      if (completados >= CAMINOS_PARA_SENDERO_COMPLETO) {
        // Cada sendero completo sugiere dos ítems: el sendero y su eje temático,
        // que comparten la misma claveProgreso
        claves.add(sendero);
      }
    }

    // Sin progreso no hay nada que sugerir; nunca se lanza error por eso
    if (claves.size === 0) return [];

    const items = await this.catalogoRepo.find({
      where: {
        claveProgreso: In([...claves]),
        // El filtro de categoría garantiza que cintas, cordón y kit nunca se
        // sugieran aunque alguien les ponga una claveProgreso desde el catálogo
        categoria: In(['progresion', 'sendero', 'eje_tematico']),
        activo: true,
      },
    });

    return items.map((item) => item.id);
  }

  // ── Auxiliares ─────────────────────────────────────────────────────────────

  /**
   * Arma la cabecera y las líneas de una solicitud a partir del DTO, sin
   * guardarlas. Lo comparten `create` y `armarTemporal`.
   */
  private async construir(
    dto: CrearSolicitudInsigniasDto,
    solicitanteId: number,
  ): Promise<{ solicitud: SolicitudInsignias; caminante: User }> {
    const caminante = await this.buscarCaminante(dto.caminanteId);
    const lineas = await this.construirLineas(dto.lineas ?? []);

    const solicitud = this.solicitudRepo.create({
      caminanteId: caminante.id,
      // La sección es la del muchacho, no la derivada del rol de quien solicita
      seccion: caminante.seccion,
      solicitanteId,
      observaciones: dto.observaciones ?? null,
      lineas,
    });

    // La fecha llega como 'YYYY-MM-DD'; se pasa tal cual para que TypeORM no la
    // interprete como UTC y la guarde un día antes
    solicitud.fecha = (dto.fecha ?? this.hoy()) as unknown as Date;

    return { solicitud, caminante };
  }

  /**
   * Valida las líneas contra el catálogo y las devuelve como entidades sin
   * guardar. Aquí vive la regla del kit de pañoleta.
   */
  private async construirLineas(
    lineasDto: LineaSolicitudInsigniasDto[],
  ): Promise<SolicitudInsigniasLinea[]> {
    if (!lineasDto.length) return [];

    const ids = [...new Set(lineasDto.map((l) => l.catalogoItemId))];
    const items = await this.catalogoRepo.find({ where: { id: In(ids) } });
    const porId = new Map(items.map((item) => [item.id, item]));

    const faltantes = ids.filter((id) => !porId.has(id));
    if (faltantes.length) {
      throw new BadRequestException(
        `No existen estos ítems del catálogo: ${faltantes.join(', ')}`,
      );
    }

    return lineasDto.map((linea) => {
      const item = porId.get(linea.catalogoItemId);
      const esKit = item.categoria === 'kit_panoleta';

      if (esKit && !linea.componentesKit?.includes(COMPONENTE_KIT_OBLIGATORIO)) {
        throw new BadRequestException(
          'El kit de pañoleta siempre debe incluir las motas',
        );
      }

      return this.lineaRepo.create({
        catalogoItemId: item.id,
        // Se hidrata para que el preview del PDF pueda agrupar por categoría
        catalogoItem: item,
        cantidad: linea.cantidad ?? 1,
        // Fuera del kit de pañoleta, componentesKit siempre va en null
        componentesKit: esKit ? linea.componentesKit : null,
        notas: linea.notas ?? null,
      });
    });
  }

  /** Busca al caminante y exige que tenga sección poblada */
  private async buscarCaminante(caminanteId: number): Promise<User> {
    const caminante = await this.userRepo.findOne({
      where: { id: caminanteId },
    });
    if (!caminante) {
      throw new NotFoundException(`No existe el caminante ${caminanteId}`);
    }
    if (!caminante.seccion || !caminante.seccion.trim()) {
      throw new BadRequestException(
        'El caminante no tiene sección asignada. Completa el perfil del scout antes de solicitar insignias.',
      );
    }
    return caminante;
  }

  /** Fecha de hoy en formato 'YYYY-MM-DD', en hora local */
  private hoy(): string {
    const ahora = new Date();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${ahora.getFullYear()}-${mes}-${dia}`;
  }
}
