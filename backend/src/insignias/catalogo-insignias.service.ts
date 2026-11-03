import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CatalogoInsignia,
  CategoriaCatalogo,
} from './entities/catalogo-insignia.entity';
import {
  CrearCatalogoInsigniaDto,
  ActualizarCatalogoInsigniaDto,
} from './dto/catalogo-insignia.dto';

/** Forma de cada ítem del seed inicial del catálogo */
interface ItemSeed {
  categoria: CategoriaCatalogo;
  nombre: string;
  claveProgreso: string | null;
}

/**
 * Los 17 ítems solicitables iniciales.
 * La correspondencia eje temático ↔ sendero sale de
 * `subir-evidencia.component.ts`, que es la fuente de verdad del proyecto:
 *   Salud y Bienestar → Cenit
 *   Medio Ambiente y Sustentabilidad → Cima
 *   Paz y Acción Comunitaria → Cumbre
 *   Habilidades para la Vida → Cuspide
 */
const CATALOGO_SEED: ItemSeed[] = [
  // ── Progresión ────────────────────────────────────────────
  { categoria: 'progresion', nombre: 'Obsidiana', claveProgreso: 'Obsidiana' },
  { categoria: 'progresion', nombre: 'Jade', claveProgreso: 'Jade' },
  { categoria: 'progresion', nombre: 'Ópalo', claveProgreso: 'Opalo' },
  { categoria: 'progresion', nombre: 'Diamante', claveProgreso: 'Diamante' },
  // ── Ejes temáticos ────────────────────────────────────────
  { categoria: 'eje_tematico', nombre: 'Salud y Bienestar', claveProgreso: 'Cenit' },
  { categoria: 'eje_tematico', nombre: 'Habilidades para la Vida', claveProgreso: 'Cuspide' },
  { categoria: 'eje_tematico', nombre: 'Medio Ambiente y Sustentabilidad', claveProgreso: 'Cima' },
  { categoria: 'eje_tematico', nombre: 'Paz y Acción Comunitaria', claveProgreso: 'Cumbre' },
  // ── Senderos ──────────────────────────────────────────────
  { categoria: 'sendero', nombre: 'Cenit', claveProgreso: 'Cenit' },
  { categoria: 'sendero', nombre: 'Cima', claveProgreso: 'Cima' },
  { categoria: 'sendero', nombre: 'Cumbre', claveProgreso: 'Cumbre' },
  { categoria: 'sendero', nombre: 'Cúspide', claveProgreso: 'Cuspide' },
  // ── Cintas de comunidad ───────────────────────────────────
  { categoria: 'cinta_comunidad', nombre: 'Integrante de Comunidad', claveProgreso: null },
  { categoria: 'cinta_comunidad', nombre: 'Coordinador', claveProgreso: null },
  { categoria: 'cinta_comunidad', nombre: 'Subcoordinador', claveProgreso: null },
  // ── Cordón de mando ───────────────────────────────────────
  { categoria: 'cordon_mando', nombre: 'Cordón de Mando', claveProgreso: null },
  // ── Kit de pañoleta ───────────────────────────────────────
  { categoria: 'kit_panoleta', nombre: 'Kit de Pañoleta', claveProgreso: null },
];

@Injectable()
export class CatalogoInsigniasService {
  constructor(
    @InjectRepository(CatalogoInsignia)
    private catalogoRepo: Repository<CatalogoInsignia>,
  ) {}

  /**
   * Inserta los 17 ítems iniciales del catálogo. Es idempotente: antes de
   * insertar comprueba que no exista ya una fila con esa (categoria, nombre),
   * así que reiniciar el backend no duplica nada.
   */
  async seedCatalogo(): Promise<void> {
    let insertados = 0;

    for (let i = 0; i < CATALOGO_SEED.length; i++) {
      const item = CATALOGO_SEED[i];

      const existente = await this.catalogoRepo.findOne({
        where: { categoria: item.categoria, nombre: item.nombre },
      });
      if (existente) continue;

      await this.catalogoRepo.save(
        this.catalogoRepo.create({
          categoria: item.categoria,
          nombre: item.nombre,
          claveProgreso: item.claveProgreso,
          orden: i + 1,
          activo: true,
        }),
      );
      insertados++;
    }

    if (insertados > 0) {
      // eslint-disable-next-line no-console
      console.log(`[CatalogoInsigniasService] Catálogo sembrado: ${insertados} ítem(s) nuevo(s)`);
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  /**
   * Lista los ítems del catálogo ordenados por categoría y luego por orden.
   * Por defecto devuelve solo los activos; pasar `false` para incluir también
   * los que se dieron de baja lógica.
   */
  async findAll(soloActivos?: boolean): Promise<CatalogoInsignia[]> {
    const incluirInactivos = soloActivos === false;

    return this.catalogoRepo.find({
      where: incluirInactivos ? {} : { activo: true },
      order: { categoria: 'ASC', orden: 'ASC' },
    });
  }

  /** Devuelve un ítem por id */
  async findOne(id: number): Promise<CatalogoInsignia> {
    const item = await this.catalogoRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`No existe el ítem de catálogo ${id}`);
    }
    return item;
  }

  /** Alta de un ítem; rechaza duplicados por (categoria, nombre) */
  async create(dto: CrearCatalogoInsigniaDto): Promise<CatalogoInsignia> {
    const duplicado = await this.catalogoRepo.findOne({
      where: { categoria: dto.categoria, nombre: dto.nombre },
    });
    if (duplicado) {
      throw new ConflictException(
        `Ya existe un ítem "${dto.nombre}" en la categoría ${dto.categoria}`,
      );
    }

    return this.catalogoRepo.save(this.catalogoRepo.create(dto));
  }

  /** Edición de un ítem */
  async update(
    id: number,
    dto: ActualizarCatalogoInsigniaDto,
  ): Promise<CatalogoInsignia> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.catalogoRepo.save(item);
  }

  /**
   * Borrado lógico: marca activo = false en vez de eliminar la fila.
   * Las solicitudes históricas siguen apuntando a ella, así que borrarla
   * de verdad las dejaría colgando.
   */
  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    item.activo = false;
    await this.catalogoRepo.save(item);
  }
}
