import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToMany, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AltaBajaInforme } from './alta-baja-informe.entity';
import { AsistenciaActividad } from './asistencia-actividad.entity';
import { ActividadPendiente } from './actividad-pendiente.entity';
import { MovimientoFinanciero } from './movimiento-financiero.entity';
import { ProgresionInforme } from './progresion-informe.entity';

@Entity('informes_mensuales')
export class InformeMensual {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  mes: number; // 1-12

  @Column({ type: 'int' })
  anio: number;

  @Column({ length: 100 })
  seccion: string;

  // Membresía - totales
  @Column({ type: 'int', default: 0 })
  totalRegistrados: number;

  @Column({ type: 'int', default: 0 })
  totalEnlace: number;

  @Column({ type: 'int', default: 0 })
  totalCaptacion: number;

  @Column({ type: 'int', default: 0 })
  totalNoRegistrados: number;

  // Caja chica
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  saldoInicial: number;

  // Observaciones generales
  @Column({ type: 'text', nullable: true })
  observacionesGenerales: string;

  @Column()
  creadoPorId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creadoPorId' })
  creadoPor: User;

  @OneToMany(() => AltaBajaInforme, (a) => a.informe, { cascade: true, eager: true })
  altasBajas: AltaBajaInforme[];

  @OneToMany(() => AsistenciaActividad, (a) => a.informe, { cascade: true, eager: true })
  actividades: AsistenciaActividad[];

  @OneToMany(() => ActividadPendiente, (a) => a.informe, { cascade: true, eager: true })
  actividadesPendientes: ActividadPendiente[];

  @OneToMany(() => MovimientoFinanciero, (m) => m.informe, { cascade: true, eager: true })
  movimientos: MovimientoFinanciero[];

  @OneToMany(() => ProgresionInforme, (p) => p.informe, { cascade: true, eager: true })
  progresiones: ProgresionInforme[];

  @CreateDateColumn()
  createdAt: Date;
}
