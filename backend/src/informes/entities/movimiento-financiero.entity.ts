import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InformeMensual } from './informe-mensual.entity';

@Entity('movimientos_financieros')
export class MovimientoFinanciero {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  informeId: number;

  @ManyToOne(() => InformeMensual, (i) => i.movimientos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'informeId' })
  informe: InformeMensual;

  @Column({ type: 'enum', enum: ['ingreso', 'egreso'] })
  tipo: 'ingreso' | 'egreso';

  @Column({ type: 'date', nullable: true })
  fecha: string;

  @Column({ length: 300 })
  concepto: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cantidad: number;

  @Column({ type: 'int', default: 0 })
  orden: number;
}
