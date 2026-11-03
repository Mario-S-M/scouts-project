import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/** Categorías de ítems solicitables del catálogo */
export type CategoriaCatalogo =
  | 'progresion'       // Obsidiana, Jade, Ópalo, Diamante
  | 'eje_tematico'     // Salud y Bienestar, Habilidades para la Vida, ...
  | 'sendero'          // Cenit, Cima, Cumbre, Cúspide
  | 'cinta_comunidad'  // Integrante, Coordinador, Subcoordinador
  | 'cordon_mando'     // Cordón de mando
  | 'kit_panoleta';    // Kit de pañoleta

/** Lista fija de categorías; se reutiliza en el enum de la columna y en los DTO */
export const CATEGORIAS_CATALOGO: CategoriaCatalogo[] = [
  'progresion',
  'eje_tematico',
  'sendero',
  'cinta_comunidad',
  'cordon_mando',
  'kit_panoleta',
];

@Entity('catalogo_insignias')
export class CatalogoInsignia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: CATEGORIAS_CATALOGO,
  })
  categoria: CategoriaCatalogo;

  @Column({ length: 200 })
  nombre: string;

  @Column({ length: 500, nullable: true })
  descripcion: string;

  /**
   * Clave que permite empatar el ítem con el progreso registrado del caminante.
   * 'Obsidiana' | 'Jade' | 'Opalo' | 'Diamante' para progresión y
   * 'Cenit' | 'Cima' | 'Cumbre' | 'Cuspide' para senderos y sus ejes temáticos.
   * En cintas, cordón y kit va en null.
   */
  @Column({ length: 50, nullable: true })
  claveProgreso: string;

  @Column({ default: 0 })
  orden: number;

  /** Borrado lógico: un ítem retirado queda inactivo pero no se elimina */
  @Column({ default: true })
  activo: boolean;
}
