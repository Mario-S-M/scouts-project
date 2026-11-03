// ─── Solicitud de insignias por caminante ────────────────────────────────────
// Refleja las entidades y DTO de backend/src/insignias/. Los nombres se copian
// tal cual del backend para que nadie tenga que traducir campos.

/** Categorías de ítems solicitables del catálogo */
export type CategoriaCatalogo =
  | 'progresion'       // Obsidiana, Jade, Ópalo, Diamante
  | 'eje_tematico'     // Salud y Bienestar, Habilidades para la Vida, ...
  | 'sendero'          // Cenit, Cima, Cumbre, Cúspide
  | 'cinta_comunidad'  // Integrante, Coordinador, Subcoordinador
  | 'cordon_mando'     // Cordón de mando
  | 'kit_panoleta';    // Kit de pañoleta

/** Lista fija de categorías, en el orden en que se muestran en pantalla */
export const CATEGORIAS_CATALOGO: CategoriaCatalogo[] = [
  'progresion',
  'eje_tematico',
  'sendero',
  'cinta_comunidad',
  'cordon_mando',
  'kit_panoleta',
];

/** Etiquetas legibles de cada categoría */
export const CATEGORIA_LABEL: Record<CategoriaCatalogo, string> = {
  progresion:      'Insignias de progresión',
  eje_tematico:    'Ejes temáticos',
  sendero:         'Senderos',
  cinta_comunidad: 'Cintas de comunidad',
  cordon_mando:    'Cordón de mando',
  kit_panoleta:    'Kit de pañoleta',
};

/**
 * Componentes del kit de pañoleta. Enum fijo en código, no filas del catálogo:
 * la obligatoriedad de 'motas' es una regla de negocio.
 */
export type ComponenteKit =
  | 'motas'          // obligatorio, no se puede quitar
  | 'escudo_grupo'
  | 'numero_grupo'
  | 'sector'         // el que dice "Michoacán"
  | 'panoleta'
  | 'flor_de_lis';

/** Lista fija de componentes del kit */
export const COMPONENTES_KIT: ComponenteKit[] = [
  'motas',
  'escudo_grupo',
  'numero_grupo',
  'sector',
  'panoleta',
  'flor_de_lis',
];

/** Componente que siempre viaja en una línea de kit de pañoleta */
export const COMPONENTE_KIT_OBLIGATORIO: ComponenteKit = 'motas';

/** Etiquetas legibles de los componentes del kit */
export const COMPONENTE_KIT_LABEL: Record<ComponenteKit, string> = {
  motas:        'Motas',
  escudo_grupo: 'Escudo de grupo',
  numero_grupo: 'Número de grupo',
  sector:       'Sector',
  panoleta:     'Pañoleta',
  flor_de_lis:  'Flor de lis',
};

/**
 * Estado inicial de las casillas del kit en el formulario (spec, sección 3):
 * motas fija, escudo / número / sector activados, pañoleta y flor de lis no.
 */
export const COMPONENTES_KIT_DEFAULT: ComponenteKit[] = [
  'motas',
  'escudo_grupo',
  'numero_grupo',
  'sector',
];

/** Los nueve roles que pueden administrar catálogo y solicitudes */
export const ROLES_JEFE_SECCION: string[] = [
  'administrador',
  'jefe_grupo',
  'jefe_manada',
  'sub_jefe_manada',
  'jefe_tropa',
  'sub_jefe_tropa',
  'jefe_comunidad',
  'sub_jefe_comunidad',
  'jefe_clan',
  'sub_jefe_clan',
];

/** Datos mínimos de un usuario embebido en la solicitud */
export interface UsuarioRef {
  id: number;
  nombre: string;
  apellidos?: string;
  email?: string;
  seccion?: string;
  rol?: string;
}

// ─── Catálogo ────────────────────────────────────────────────────────────────

/** Ítem solicitable del catálogo editable */
export interface CatalogoInsignia {
  id: number;
  categoria: CategoriaCatalogo;
  nombre: string;
  descripcion: string | null;
  /**
   * Clave que empata el ítem con el progreso del caminante.
   * 'Obsidiana' | 'Jade' | 'Opalo' | 'Diamante' para progresión y
   * 'Cenit' | 'Cima' | 'Cumbre' | 'Cuspide' para senderos y ejes temáticos.
   */
  claveProgreso: string | null;
  orden: number;
  /** Borrado lógico: un ítem retirado queda inactivo pero no se elimina */
  activo: boolean;
}

/** Alta de un ítem del catálogo */
export interface CrearCatalogoInsigniaDto {
  categoria: CategoriaCatalogo;
  nombre: string;
  descripcion?: string | null;
  claveProgreso?: string | null;
  orden?: number;
  activo?: boolean;
}

/** Edición de un ítem del catálogo: todos los campos son opcionales */
export type ActualizarCatalogoInsigniaDto = Partial<CrearCatalogoInsigniaDto>;

// ─── Solicitudes ─────────────────────────────────────────────────────────────

/** Una línea de la solicitud: ítem del catálogo + cantidad */
export interface SolicitudInsigniasLinea {
  id: number;
  solicitudId: number;
  catalogoItemId: number;
  catalogoItem: CatalogoInsignia;
  cantidad: number;
  /** Solo se llena cuando catalogoItem.categoria === 'kit_panoleta' */
  componentesKit: ComponenteKit[] | null;
  notas: string | null;
}

/** Cabecera de la solicitud, una por caminante */
export interface SolicitudInsignias {
  id: number;
  caminanteId: number;
  caminante?: UsuarioRef;
  /** 'YYYY-MM-DD' */
  fecha: string;
  /** Se copia de caminante.seccion; no se captura a mano */
  seccion: string;
  solicitanteId: number;
  solicitante?: UsuarioRef;
  observaciones: string | null;
  /** ISO 8601 */
  createdAt: string;
  lineas: SolicitudInsigniasLinea[];
}

/** Línea que viaja al backend al guardar */
export interface LineaSolicitudInsigniasDto {
  catalogoItemId: number;
  cantidad?: number;
  /** Solo para el kit de pañoleta; si viene, debe incluir 'motas' */
  componentesKit?: ComponenteKit[];
  notas?: string;
}

/**
 * Alta de una solicitud. No se capturan ni `seccion` (la copia el backend de
 * caminante.seccion) ni `solicitanteId` (sale del JWT).
 */
export interface CrearSolicitudInsigniasDto {
  caminanteId: number;
  /** 'YYYY-MM-DD' */
  fecha?: string;
  observaciones?: string;
  lineas: LineaSolicitudInsigniasDto[];
}

/** Edición de una solicitud: todos los campos son opcionales */
export type ActualizarSolicitudInsigniasDto = Partial<CrearSolicitudInsigniasDto>;
