import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('avisos_salida')
export class AvisoSalida {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 60 })
  tipo: string;

  @Column({ length: 120 })
  nombre: string;

  /** Sección dueña del aviso (manada, tropa, comunidad, clan); candado de permisos */
  @Column({ length: 20, nullable: true })
  seccion: string;

  @Column({ type: 'date', nullable: true })
  fechaSalida: string;

  @Column({ nullable: true })
  creadoPorId: number;

  @Column({ length: 120, nullable: true })
  creadoPorNombre: string;

  // Payload completo para regenerar el PDF
  @Column({ type: 'jsonb' })
  data: any;

  @CreateDateColumn()
  createdAt: Date;
}
