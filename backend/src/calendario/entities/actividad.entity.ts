import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SeccionActividad = 'general' | 'manada' | 'tropa' | 'comunidad' | 'clan';

/** Tipo de actividad (ícono y color en el calendario) */
export const TIPOS_ACTIVIDAD = ['consejo', 'salida', 'pase', 'grupal', 'reunion'] as const;
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number];

/**
 * Quién la ve:
 * - publica: todo el grupo, jóvenes incluidos (para organizar pases y aventuras)
 * - seccion: jóvenes y scouters de las secciones marcadas
 * - scouters: solo scouters (p. ej. "en esta aventura será el pase de…")
 */
export const VISIBILIDADES = ['publica', 'seccion', 'scouters'] as const;
export type Visibilidad = (typeof VISIBILIDADES)[number];

/** Secciones de una actividad: manada, tropa, comunidad, clan o 'grupo' (todas) */
export const SECCIONES_ACTIVIDAD = ['manada', 'tropa', 'comunidad', 'clan', 'grupo'] as const;

@Entity('actividades_calendario')
export class Actividad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  titulo: string;

  @Column({ length: 1000, nullable: true })
  descripcion: string;

  @Column({ type: 'date' })
  fecha: string; // 'YYYY-MM-DD'

  @Column({ type: 'time', nullable: true })
  hora: string; // 'HH:mm:ss'

  @Column({ length: 200, nullable: true })
  lugar: string;

  /** Compatibilidad (recordatorios por sección): primera sección o 'general' */
  @Column({ type: 'varchar', length: 20 })
  seccion: SeccionActividad;

  /** Secciones de la actividad; ['grupo'] = todo el grupo */
  @Column({ type: 'simple-array', nullable: true })
  secciones: string[];

  @Column({ type: 'varchar', length: 20, default: 'reunion' })
  tipo: TipoActividad;

  @Column({ type: 'varchar', length: 15, default: 'publica' })
  visibilidad: Visibilidad;

  @Column()
  creadoPorId: number;

  @CreateDateColumn()
  fechaCreacion: Date;

  @UpdateDateColumn()
  fechaActualizacion: Date;
}
