import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InformeMensual } from './informe-mensual.entity';

@Entity('actividades_pendientes')
export class ActividadPendiente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  informeId: number;

  @ManyToOne(() => InformeMensual, (i) => i.actividadesPendientes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'informeId' })
  informe: InformeMensual;

  @Column({ length: 200 })
  actividad: string;

  @Column({ length: 500, nullable: true })
  observaciones: string;

  @Column({ type: 'int', default: 0 })
  orden: number;
}
