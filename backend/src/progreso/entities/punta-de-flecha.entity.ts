import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type TipoPuntaDeFlecha = 'participacion' | 'certificacion';

@Entity('punta_de_flecha')
export class PuntaDeFlecha {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, (c) => c.puntasDeFlecha)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({
    type: 'enum',
    enum: ['participacion', 'certificacion'],
  })
  tipo: TipoPuntaDeFlecha;

  @Column({ default: false })
  completado: boolean;

  @Column({ type: 'date', nullable: true })
  fechaCompletado: Date;
}
