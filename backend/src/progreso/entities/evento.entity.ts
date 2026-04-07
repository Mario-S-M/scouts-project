import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type TipoEvento = 'Provincia' | 'Nacional' | 'Internacional';

@Entity('eventos')
export class Evento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, (c) => c.eventos)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({
    type: 'enum',
    enum: ['Provincia', 'Nacional', 'Internacional'],
  })
  tipo: TipoEvento;

  @Column({ length: 300 })
  nombre: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ length: 300, nullable: true })
  ejeTematico: string;

  @Column({ length: 500, nullable: true })
  evidenciaUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
