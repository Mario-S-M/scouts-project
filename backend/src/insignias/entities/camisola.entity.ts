import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('camisolas')
export class Camisola {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, (c) => c.camisolas)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({ default: false })
  otorgada: boolean;

  @Column({ type: 'date', nullable: true })
  fechaOtorgada: Date;

  @Column({ length: 10, nullable: true })
  talla: string;
}
