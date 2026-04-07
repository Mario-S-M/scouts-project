import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('especialidad_progreso')
export class EspecialidadProgreso {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, (c) => c.especialidadesProgreso)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({ length: 200 })
  especialidad: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ length: 200, nullable: true })
  senderoArea: string;

  @Column({ default: false })
  conozco: boolean;

  @Column({ default: false })
  aplico: boolean;

  @Column({ default: false })
  comparto: boolean;

  @Column({ default: false })
  completado: boolean;

  @Column({ type: 'date', nullable: true })
  fechaCompletado: Date;
}
