import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Papá, mamá o tutor de un joven: solo datos de contacto (no entra a la app) */
@Entity('tutores')
export class Tutor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caminanteId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caminanteId' })
  caminante: User;

  @Column({ length: 150 })
  nombre: string;

  /** Mamá, papá, abuela, tutor… */
  @Column({ length: 40, nullable: true })
  parentesco: string;

  @Column({ length: 30, nullable: true })
  telefono: string;

  @Column({ length: 150, nullable: true })
  email: string;

  /** 0 = contacto principal, 1 = secundario */
  @Column({ default: 0 })
  orden: number;

  @CreateDateColumn()
  createdAt: Date;
}
