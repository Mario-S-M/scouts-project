import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InformeMensual } from './informe-mensual.entity';

@Entity('asistencias_actividad')
export class AsistenciaActividad {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  informeId: number;

  @ManyToOne(() => InformeMensual, (i) => i.actividades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'informeId' })
  informe: InformeMensual;

  @Column({ type: 'date', nullable: true })
  fecha: string;

  @Column({ length: 200 })
  actividad: string;

  @Column({ type: 'int', default: 0 })
  asistencia: number;

  @Column({ type: 'simple-json', nullable: true, default: '[]' })
  asistentes: string[];

  @Column({ length: 500, nullable: true })
  observaciones: string;

  @Column({ type: 'int', default: 0 })
  orden: number;
}
