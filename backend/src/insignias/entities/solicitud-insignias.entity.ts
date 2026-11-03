import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SolicitudInsigniasLinea } from './solicitud-insignias-linea.entity';

@Entity('solicitudes_insignias')
export class SolicitudInsignias {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  fecha: Date;

  /** Se copia de caminante.seccion; no se captura a mano */
  @Column({ length: 100 })
  seccion: string;

  /** Quien crea la solicitud; sale de req.user.id */
  @Column()
  solicitanteId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'solicitanteId' })
  solicitante: User;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => SolicitudInsigniasLinea, (l) => l.solicitud, {
    cascade: true,
  })
  lineas: SolicitudInsigniasLinea[];
}
