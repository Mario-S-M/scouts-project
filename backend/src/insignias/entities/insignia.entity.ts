import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type TipoInsignia = 'Obsidiana' | 'Jade' | 'Opalo' | 'Diamante';

@Entity('insignias')
export class Insignia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, (c) => c.insignias)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({
    type: 'enum',
    enum: ['Obsidiana', 'Jade', 'Opalo', 'Diamante'],
  })
  tipo: TipoInsignia;

  @Column({ default: false })
  otorgada: boolean;

  @Column({ type: 'date', nullable: true })
  fechaOtorgada: Date;

  @Column({ length: 200, nullable: true })
  validadoPor: string;
}
