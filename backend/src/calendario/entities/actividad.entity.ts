import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SeccionActividad = 'general' | 'manada' | 'tropa' | 'comunidad' | 'clan';

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

  @Column({ type: 'varchar', length: 20 })
  seccion: SeccionActividad;

  @Column()
  creadoPorId: number;

  @CreateDateColumn()
  fechaCreacion: Date;

  @UpdateDateColumn()
  fechaActualizacion: Date;
}
