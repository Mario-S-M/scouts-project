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

export enum UserRole {
  // Grupo
  JEFE_GRUPO          = 'jefe_grupo',
  SUB_JEFE_GRUPO      = 'sub_jefe_grupo',
  COLABORADOR_GRUPO   = 'colaborador_grupo',
  CONTADOR_GRUPO      = 'contador_grupo',
  SECRETARIO_GRUPO    = 'secretario_grupo',
  // Manada
  JEFE_MANADA         = 'jefe_manada',
  SUB_JEFE_MANADA     = 'sub_jefe_manada',
  // Tropa
  JEFE_TROPA          = 'jefe_tropa',
  SUB_JEFE_TROPA      = 'sub_jefe_tropa',
  // Comunidad
  JEFE_COMUNIDAD      = 'jefe_comunidad',
  SUB_JEFE_COMUNIDAD  = 'sub_jefe_comunidad',
  // Clan
  JEFE_CLAN           = 'jefe_clan',
  SUB_JEFE_CLAN       = 'sub_jefe_clan',
  // Joven
  SCOUT               = 'scout',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Datos de autenticación ────────────────────────────────
  @Column({ length: 200 })
  nombre: string;

  @Column({ length: 200, unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', length: 50, default: UserRole.SCOUT })
  rol: string;

  @Column({ default: true })
  activo: boolean;

  // ── Datos de perfil scout (solo aplican a rol=scout) ──────
  @Column({ length: 100, nullable: true })
  apellidos: string;

  @Column({ length: 100, nullable: true })
  grupo: string;

  @Column({ length: 100, nullable: true })
  provincia: string;

  @Column({ length: 100, nullable: true })
  comunidad: string;

  @Column({ length: 100, nullable: true })
  seccion: string;

  @Column({ length: 100, nullable: true })
  equipo: string;

  @Column({ length: 50, nullable: true })
  cum: string;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ type: 'date', nullable: true })
  fechaPromesa: Date;

  @Column({ type: 'date', nullable: true })
  fechaPaseInicio: Date;

  @Column({ length: 500, nullable: true })
  foto: string;

  @CreateDateColumn()
  createdAt: Date;

  // ── Relaciones (scouts) ───────────────────────────────────
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
