import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type SenderoTipo = 'Cenit' | 'Cima' | 'Cumbre' | 'Cuspide';

@Entity('sendero_progreso')
export class SenderoProgreso {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, (c) => c.senderosProgreso)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({
    type: 'enum',
    enum: ['Cenit', 'Cima', 'Cumbre', 'Cuspide'],
  })
  sendero: SenderoTipo;

  @Column({ length: 200 })
  camino: string;

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
