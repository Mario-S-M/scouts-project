import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Inventario persistente por sección — no está ligado a un informe mensual */
@Entity('inventario_items')
export class InventarioItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  seccion: string;

  @Column({ type: 'int', nullable: true })
  anioCompra: number;

  @Column({ length: 100, nullable: true, default: '' })
  marca: string;

  @Column({ length: 300 })
  descripcion: string;

  @Column({ type: 'int', default: 1 })
  cantidad: number;

  @Column({ length: 500, nullable: true, default: '' })
  observaciones: string;

  @CreateDateColumn()
  createdAt: Date;
}
