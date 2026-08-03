import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';
import { SeccionActividad } from './actividad.entity';

@Entity('configuraciones_recordatorio')
export class ConfiguracionRecordatorio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  seccion: SeccionActividad;

  @Column({ type: 'int', default: 3 })
  diaSemana: number; // 0=domingo ... 6=sábado

  @Column({ type: 'time', default: '10:00:00' })
  hora: string; // 'HH:mm:ss'

  @Column({ default: true })
  habilitado: boolean;

  @Column({ type: 'date', nullable: true })
  ultimoEnvio: string | null;

  @Column({ nullable: true })
  actualizadoPorId: number;

  @UpdateDateColumn()
  fechaActualizacion: Date;
}
