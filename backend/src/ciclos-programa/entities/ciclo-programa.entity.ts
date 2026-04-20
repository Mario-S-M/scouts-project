import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ActividadCiclo } from './actividad-ciclo.entity';

export type TipoCiclo = 'trimestral' | 'cuatrimestral';

@Entity('ciclos_programa')
export class CicloPrograma {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  nombre: string;

  @Column({ type: 'int' })
  mesInicio: number; // 1-12

  @Column({ type: 'int' })
  anio: number;

  @Column({ type: 'enum', enum: ['trimestral', 'cuatrimestral'] })
  tipo: TipoCiclo;

  @Column({ length: 100 })
  seccion: string; // comunidad, tropa, manada, clan

  @Column()
  creadoPorId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creadoPorId' })
  creadoPor: User;

  @OneToMany(() => ActividadCiclo, (a) => a.ciclo, { cascade: true, eager: true })
  actividades: ActividadCiclo[];

  @CreateDateColumn()
  createdAt: Date;
}
