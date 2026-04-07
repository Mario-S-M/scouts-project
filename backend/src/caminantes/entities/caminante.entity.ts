import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Evidencia } from '../../evidencias/entities/evidencia.entity';
import { SenderoProgreso } from '../../progreso/entities/sendero-progreso.entity';
import { EspecialidadProgreso } from '../../progreso/entities/especialidad-progreso.entity';
import { AventuraProgreso } from '../../progreso/entities/aventura-progreso.entity';
import { IniciativaProgreso } from '../../progreso/entities/iniciativa-progreso.entity';
import { Evento } from '../../progreso/entities/evento.entity';
import { PuntaDeFlecha } from '../../progreso/entities/punta-de-flecha.entity';
import { Insignia } from '../../insignias/entities/insignia.entity';
import { Camisola } from '../../insignias/entities/camisola.entity';

@Entity('caminantes')
export class Caminante {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 100 })
  apellidos: string;

  @Column({ length: 100 })
  grupo: string;

  @Column({ length: 100 })
  provincia: string;

  @Column({ length: 100 })
  comunidad: string;

  @Column({ length: 100, nullable: true })
  equipo: string;

  @Column({ type: 'date', nullable: true })
  fechaPromesa: Date;

  @Column({ type: 'date', nullable: true })
  fechaPaseInicio: Date;

  @Column({ length: 200, nullable: true })
  email: string;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ length: 50, nullable: true })
  cum: string;

  @Column({ length: 500, nullable: true })
  foto: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Evidencia, (e) => e.caminante)
  evidencias: Evidencia[];

  @OneToMany(() => SenderoProgreso, (s) => s.caminante)
  senderosProgreso: SenderoProgreso[];

  @OneToMany(() => EspecialidadProgreso, (e) => e.caminante)
  especialidadesProgreso: EspecialidadProgreso[];

  @OneToMany(() => AventuraProgreso, (a) => a.caminante)
  aventurasProgreso: AventuraProgreso[];

  @OneToMany(() => IniciativaProgreso, (i) => i.caminante)
  iniciativasProgreso: IniciativaProgreso[];

  @OneToMany(() => Evento, (e) => e.caminante)
  eventos: Evento[];

  @OneToMany(() => PuntaDeFlecha, (p) => p.caminante)
  puntasDeFlecha: PuntaDeFlecha[];

  @OneToMany(() => Insignia, (i) => i.caminante)
  insignias: Insignia[];

  @OneToMany(() => Camisola, (c) => c.caminante)
  camisolas: Camisola[];
}
