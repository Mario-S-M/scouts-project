import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type TipoEvidencia =
  | 'sendero'
  | 'especialidad'
  | 'aventura'
  | 'iniciativa'
  | 'evento'
  | 'puntaDeFlecha';

export type EtapaEvidencia =
  | 'conozco'
  | 'aplico'
  | 'comparto'
  | 'participacion'
  | 'certificacion';

export type EstadoEvidencia = 'pendiente' | 'aprobada' | 'rechazada';

@Entity('evidencias')
export class Evidencia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, (c) => c.evidencias)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({
    type: 'enum',
    enum: ['sendero', 'especialidad', 'aventura', 'iniciativa', 'evento', 'puntaDeFlecha'],
  })
  tipo: TipoEvidencia;

  @Column({ length: 200 })
  categoria: string;

  @Column({ length: 200, nullable: true })
  subcategoria: string;

  @Column({
    type: 'enum',
    enum: ['conozco', 'aplico', 'comparto', 'participacion', 'certificacion'],
    nullable: true,
  })
  etapa: EtapaEvidencia;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ length: 500, nullable: true })
  archivoUrl: string;

  @Column({
    type: 'enum',
    enum: ['pendiente', 'aprobada', 'rechazada'],
    default: 'pendiente',
  })
  estado: EstadoEvidencia;

  @Column({ type: 'text', nullable: true })
  comentarioValidador: string;

  @Column({ length: 200, nullable: true })
  validadoPor: string;

  @CreateDateColumn()
  fechaSubida: Date;

  @Column({ type: 'timestamp', nullable: true })
  fechaValidacion: Date;
}
