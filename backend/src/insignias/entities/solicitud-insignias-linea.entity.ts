import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SolicitudInsignias } from './solicitud-insignias.entity';
import { CatalogoInsignia } from './catalogo-insignia.entity';

/**
 * Componentes del kit de pañoleta. Es un enum fijo en código, no filas del
 * catálogo editable: la obligatoriedad de 'motas' es una regla de negocio y no
 * debe poder desactivarse editando una tabla.
 */
export type ComponenteKit =
  | 'motas'          // obligatorio, no se puede quitar
  | 'escudo_grupo'
  | 'numero_grupo'
  | 'sector'         // el que dice "Michoacán"
  | 'panoleta'
  | 'flor_de_lis';

/** Lista fija de componentes del kit; se reutiliza en los DTO */
export const COMPONENTES_KIT: ComponenteKit[] = [
  'motas',
  'escudo_grupo',
  'numero_grupo',
  'sector',
  'panoleta',
  'flor_de_lis',
];

/** Componente que siempre debe venir incluido en una línea de kit de pañoleta */
export const COMPONENTE_KIT_OBLIGATORIO: ComponenteKit = 'motas';

@Entity('solicitud_insignias_lineas')
export class SolicitudInsigniasLinea {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  solicitudId: number;

  @ManyToOne(() => SolicitudInsignias, (s) => s.lineas, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'solicitudId' })
  solicitud: SolicitudInsignias;

  @Column()
  catalogoItemId: number;

  @ManyToOne(() => CatalogoInsignia, { eager: true })
  @JoinColumn({ name: 'catalogoItemId' })
  catalogoItem: CatalogoInsignia;

  @Column({ default: 1 })
  cantidad: number;

  /** Solo se llena cuando catalogoItem.categoria === 'kit_panoleta' */
  @Column({ type: 'simple-array', nullable: true })
  componentesKit: ComponenteKit[];

  @Column({ length: 300, nullable: true })
  notas: string;
}
