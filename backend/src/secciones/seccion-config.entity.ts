import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Identidad de cada sección: nombres (vocabulario), colores y logo. La edita el
 * administrador; la usan el navbar, las pantallas y los PDFs.
 */
@Entity('secciones_config')
export class SeccionConfig {
  /** grupo, manada, tropa, comunidad, clan */
  @PrimaryColumn({ length: 20 })
  clave: string;

  /** "Manada de Lobatos" */
  @Column({ length: 80 })
  nombreCompleto: string;

  /** "Manada" */
  @Column({ length: 40 })
  nombreCorto: string;

  /** "lobato o lobezna" */
  @Column({ length: 60 })
  jovenSingular: string;

  /** "lobatos y lobeznas" */
  @Column({ length: 60 })
  jovenPlural: string;

  @Column({ length: 80 })
  cargoJefe: string;

  @Column({ length: 80 })
  cargoSubjefe: string;

  @Column({ length: 9 })
  colorPrincipal: string;

  @Column({ length: 9 })
  colorOscuro: string;

  @Column({ length: 9 })
  colorAcento: string;

  /** Color del texto sobre el acento (avatar, botones) */
  @Column({ length: 9, default: '#FFFFFF' })
  colorTextoAcento: string;

  /** Ruta servida por el backend (/uploads/secciones/…) o null = logo del grupo */
  @Column({ type: 'varchar', length: 200, nullable: true })
  logo: string | null;

  /** Senderos, especialidades e insignias (metodología de Caminantes) */
  @Column({ default: false })
  progresionHabilitada: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
