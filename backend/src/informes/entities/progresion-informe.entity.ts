import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { InformeMensual } from './informe-mensual.entity';

@Entity('progresiones_informe')
export class ProgresionInforme {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  informeId: number;

  @ManyToOne(() => InformeMensual, (i) => i.progresiones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'informeId' })
  informe: InformeMensual;

  /** Ej: "Insignia Jade", "Insignia Camisola", "Reconocimiento" */
  @Column({ length: 200 })
  descripcion: string;

  @Column({ length: 200 })
  nombre: string; // nombre del caminante

  @Column({ length: 200, nullable: true })
  actividadNombre: string; // actividad en la que se entregó

  @Column({ type: 'date', nullable: true })
  fecha: string;

  @Column({ type: 'int', default: 0 })
  orden: number;
}
