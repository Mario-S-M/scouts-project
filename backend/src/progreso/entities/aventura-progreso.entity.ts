import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type AventuraTipo = 'TerraNova' | 'KonTiki' | '7Cimas' | 'Discovery';

@Entity('aventura_progreso')
export class AventuraProgreso {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, (c) => c.aventurasProgreso)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({
    type: 'enum',
    enum: ['TerraNova', 'KonTiki', '7Cimas', 'Discovery'],
  })
  aventura: AventuraTipo;

  @Column({ default: false })
  completado: boolean;

  @Column({ type: 'date', nullable: true })
  fechaCompletado: Date;
}
