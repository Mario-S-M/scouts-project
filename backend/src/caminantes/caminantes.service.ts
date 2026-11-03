import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { User, UserRole } from '../users/entities/user.entity';
import { SenderoProgreso } from '../progreso/entities/sendero-progreso.entity';
import { EspecialidadProgreso } from '../progreso/entities/especialidad-progreso.entity';
import { AventuraProgreso } from '../progreso/entities/aventura-progreso.entity';
import { IniciativaProgreso } from '../progreso/entities/iniciativa-progreso.entity';
import { Evento } from '../progreso/entities/evento.entity';
import { PuntaDeFlecha } from '../progreso/entities/punta-de-flecha.entity';
import { Insignia } from '../insignias/entities/insignia.entity';
import { CreateCaminanteDto } from './dto/create-caminante.dto';
import { Tutor } from './entities/tutor.entity';
import { TutorDto } from './dto/tutores.dto';
import {
  UsuarioToken, assertPuedeEditar, assertPuedeVer, esAdmin, seccionParaCrear,
} from '../common/rol-seccion.util';

const SENDEROS_CAMINOS = {
  Cenit:   ['Alimentación Saludable', 'Actividad Física', 'Salud Mental', 'Primeros Auxilios', 'Higiene y Prevención'],
  Cima:    ['Biodiversidad', 'Cambio Climático', 'Agua y Océanos', 'Residuos y Reciclaje', 'Energía Renovable'],
  Cumbre:  ['Ciudadanía Activa', 'Derechos Humanos', 'Resolución de Conflictos', 'Liderazgo Comunitario', 'Servicio Social'],
  Cuspide: ['Comunicación Efectiva', 'Emprendimiento', 'Tecnología Digital', 'Gestión del Tiempo', 'Pensamiento Crítico'],
};

@Injectable()
export class CaminantesService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(SenderoProgreso)
    private senderoRepo: Repository<SenderoProgreso>,
    @InjectRepository(EspecialidadProgreso)
    private especialidadRepo: Repository<EspecialidadProgreso>,
    @InjectRepository(AventuraProgreso)
    private aventuraRepo: Repository<AventuraProgreso>,
    @InjectRepository(IniciativaProgreso)
    private iniciativaRepo: Repository<IniciativaProgreso>,
    @InjectRepository(Evento)
    private eventoRepo: Repository<Evento>,
    @InjectRepository(PuntaDeFlecha)
    private puntaRepo: Repository<PuntaDeFlecha>,
    @InjectRepository(Insignia)
    private insigniaRepo: Repository<Insignia>,
    @InjectRepository(Tutor)
    private tutorRepo: Repository<Tutor>,
  ) {}

  // ── Papás / tutores ────────────────────────────────────────────────────────
  async getTutores(id: number, user: UsuarioToken): Promise<Tutor[]> {
    await this.findOne(id, user);
    return this.tutorRepo.find({ where: { caminanteId: id }, order: { orden: 'ASC' } });
  }

  /** Reemplaza los tutores del joven (máximo 2, validado en el DTO) */
  async guardarTutores(id: number, tutores: TutorDto[], user: UsuarioToken): Promise<Tutor[]> {
    const caminante = await this.userRepo.findOne({ where: { id, rol: UserRole.SCOUT } });
    if (!caminante) throw new NotFoundException(`Joven #${id} no encontrado`);
    assertPuedeEditar(user, caminante.seccion);
    await this.tutorRepo.delete({ caminanteId: id });
    await this.tutorRepo.save(tutores.map((t, orden) => this.tutorRepo.create({ ...t, caminanteId: id, orden })));
    return this.tutorRepo.find({ where: { caminanteId: id }, order: { orden: 'ASC' } });
  }

  async findAll(seccion?: string): Promise<User[]> {
    const where: any = { rol: UserRole.SCOUT };
    if (seccion) where.seccion = seccion;
    return this.userRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async create(dto: CreateCaminanteDto, solicitante: UsuarioToken): Promise<User> {
    dto.seccion = seccionParaCrear(solicitante, dto.seccion);
    // Contraseña inicial: la indicada, su CUM, o una aleatoria (nunca una fija y pública)
    const rawPassword = (dto as any).password || dto.cum || randomBytes(12).toString('base64url');
    const hash = await bcrypt.hash(rawPassword, 10);

    const user = this.userRepo.create({
      nombre:          dto.nombre,
      apellidos:       dto.apellidos,
      email:           dto.email || `${dto.nombre.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@scouts.local`,
      password:        hash,
      rol:             UserRole.SCOUT,
      grupo:           dto.grupo || '7',
      provincia:       dto.provincia || 'Michoacán',
      comunidad:       dto.comunidad || 'Itsï Tarhiata',
      seccion:         dto.seccion,
      equipo:          dto.equipo,
      fechaPromesa:    dto.fechaPromesa as any,
      fechaPaseInicio: dto.fechaPaseInicio as any,
      fechaNacimiento: dto.fechaNacimiento as any,
      cum:             dto.cum,
    });

    const saved = await this.userRepo.save(user);

    // Senderos, aventuras e iniciativas son la progresión de Caminantes;
    // las demás secciones todavía no tienen la suya en la app
    if (saved.seccion !== 'comunidad') return saved;

    for (const [sendero, caminos] of Object.entries(SENDEROS_CAMINOS)) {
      for (const camino of caminos) {
        await this.senderoRepo.save(
          this.senderoRepo.create({ caminanteId: saved.id, sendero: sendero as any, camino, completado: false }),
        );
      }
    }

    for (const av of ['TerraNova', 'KonTiki', '7Cimas', 'Discovery'] as const) {
      await this.aventuraRepo.save(
        this.aventuraRepo.create({ caminanteId: saved.id, aventura: av, completado: false }),
      );
    }

    for (const ini of ['MOP', 'ChampionsForNature', 'PlasticTideTurners', 'ScoutsGoSolar', 'AccionesHumanitarias'] as const) {
      await this.iniciativaRepo.save(
        this.iniciativaRepo.create({ caminanteId: saved.id, iniciativa: ini, nivel: 'participacion', completado: false }),
      );
    }

    return saved;
  }

  /** Sin `user` es uso interno (p. ej. rutas /me del propio scout) y no se filtra */
  async findOne(id: number, user?: UsuarioToken): Promise<User> {
    const caminante = await this.userRepo.findOne({
      where: { id, rol: UserRole.SCOUT },
      relations: [
        'senderosProgreso', 'especialidadesProgreso', 'aventurasProgreso',
        'iniciativasProgreso', 'eventos', 'puntasDeFlecha',
        'insignias', 'camisolas', 'evidencias',
      ],
    });
    if (!caminante) throw new NotFoundException(`Scout #${id} no encontrado`);
    if (user) assertPuedeVer(user, caminante.seccion);
    return caminante;
  }

  async getProgreso(id: number) {
    const caminante = await this.findOne(id);
    const senderos = ['Cenit', 'Cima', 'Cumbre', 'Cuspide'];

    const senderosProgress = senderos.map((sendero) => {
      const caminos = caminante.senderosProgreso.filter((s) => s.sendero === sendero);
      const total = SENDEROS_CAMINOS[sendero]?.length || 5;
      const completados = caminos.filter((c) => c.completado).length;
      return {
        sendero, total, completados,
        porcentaje: total > 0 ? Math.round((completados / total) * 100) : 0,
        caminos: caminos.map((c) => ({
          camino: c.camino, conozco: c.conozco, aplico: c.aplico,
          comparto: c.comparto, completado: c.completado, fechaCompletado: c.fechaCompletado,
        })),
      };
    });

    const especialidades = caminante.especialidadesProgreso;
    const aventuras = caminante.aventurasProgreso;
    const iniciativas = caminante.iniciativasProgreso;
    const eventos = caminante.eventos || [];

    let mesesEnPrograma = 0;
    if (caminante.fechaPaseInicio) {
      const inicio = new Date(caminante.fechaPaseInicio);
      const ahora = new Date();
      mesesEnPrograma = (ahora.getFullYear() - inicio.getFullYear()) * 12 + (ahora.getMonth() - inicio.getMonth());
    }

    return {
      caminanteId: id,
      nombre: `${caminante.nombre} ${caminante.apellidos}`,
      senderos: senderosProgress,
      senderosCompletados: senderosProgress.filter((s) => s.porcentaje === 100).length,
      especialidades: especialidades.map((e) => ({
        id: e.id, especialidad: e.especialidad, nombre: e.nombre,
        senderoArea: e.senderoArea, conozco: e.conozco, aplico: e.aplico,
        comparto: e.comparto, completado: e.completado,
      })),
      especialidadesCompletadas: especialidades.filter((e) => e.completado).length,
      aventuras: aventuras.map((a) => ({ aventura: a.aventura, completado: a.completado, fechaCompletado: a.fechaCompletado })),
      terraNova: aventuras.find((a) => a.aventura === 'TerraNova')?.completado || false,
      otrasAventuras: aventuras.filter((a) => a.aventura !== 'TerraNova' && a.completado).length,
      iniciativas: iniciativas.map((i) => ({ iniciativa: i.iniciativa, nivel: i.nivel, completado: i.completado })),
      iniciativasCompletadas: iniciativas.filter((i) => i.completado).length,
      eventos,
      eventosProvincia: eventos.filter((e) => e.tipo === 'Provincia').length,
      eventosNacional: eventos.filter((e) => e.tipo === 'Nacional').length,
      eventosInternacional: eventos.filter((e) => e.tipo === 'Internacional').length,
      totalEventos: eventos.length,
      puntaParticipacion: !!(caminante.puntasDeFlecha?.find((p) => p.tipo === 'participacion' && p.completado)),
      puntaCertificacion: !!(caminante.puntasDeFlecha?.find((p) => p.tipo === 'certificacion' && p.completado)),
      mesesEnPrograma,
      insignias: (caminante.insignias || []).map((i) => ({ tipo: i.tipo, otorgada: i.otorgada, fechaOtorgada: i.fechaOtorgada })),
    };
  }

  async update(id: number, dto: Partial<CreateCaminanteDto>, user: UsuarioToken): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { id, rol: UserRole.SCOUT } });
    if (!existing) throw new NotFoundException(`Scout #${id} no encontrado`);
    assertPuedeEditar(user, existing.seccion);
    // Cambiar a un joven de sección solo lo hace el administrador
    if (dto.seccion && dto.seccion !== existing.seccion && !esAdmin(user.rol)) {
      throw new ForbiddenException('Solo el administrador puede cambiar a un joven de sección');
    }
    const data: any = { ...dto };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    } else {
      delete data.password;
    }
    await this.userRepo.update(id, data);
    return this.findOne(id);
  }
}
