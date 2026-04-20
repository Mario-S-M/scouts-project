import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InformeMensual } from './informe-mensual.entity';

@Entity('altas_bajas_informe')
export class AltaBajaInforme {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  informeId: number;

  @ManyToOne(() => InformeMensual, (i) => i.altasBajas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'informeId' })
  informe: InformeMensual;

  @Column({ type: 'enum', enum: ['alta', 'baja'] })
  tipo: 'alta' | 'baja';

  @Column({ length: 50, nullable: true })
  cum: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ type: 'int', default: 0 })
  orden: number;
}
