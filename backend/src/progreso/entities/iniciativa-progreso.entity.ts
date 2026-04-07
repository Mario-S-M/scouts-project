import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type IniciativaTipo =
  | 'MOP'
  | 'ChampionsForNature'
  | 'PlasticTideTurners'
  | 'ScoutsGoSolar'
  | 'AccionesHumanitarias';

export type NivelIniciativa = 'participacion' | 'certificacion';

@Entity('iniciativa_progreso')
export class IniciativaProgreso {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, (c) => c.iniciativasProgreso)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({
    type: 'enum',
    enum: ['MOP', 'ChampionsForNature', 'PlasticTideTurners', 'ScoutsGoSolar', 'AccionesHumanitarias'],
  })
  iniciativa: IniciativaTipo;

  @Column({
    type: 'enum',
    enum: ['participacion', 'certificacion'],
    default: 'participacion',
  })
  nivel: NivelIniciativa;

  @Column({ default: false })
  completado: boolean;

  @Column({ type: 'date', nullable: true })
  fechaCompletado: Date;
}
