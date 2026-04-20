import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CicloPrograma } from './ciclo-programa.entity';

@Entity('actividades_ciclo')
export class ActividadCiclo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cicloId: number;

  @ManyToOne(() => CicloPrograma, (c) => c.actividades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cicloId' })
  ciclo: CicloPrograma;

  @Column({ type: 'date' })
  fechaSabado: string; // ISO date string of the Saturday

  @Column({ length: 200, nullable: true, default: '' })
  nombre: string;

  @Column({ length: 100, nullable: true, default: '' })
  ejeTematico: string;

  @Column({ length: 500, nullable: true })
  descripcion: string;

  @Column({ type: 'int' })
  orden: number; // 1, 2, 3... for display order
}
