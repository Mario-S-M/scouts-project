import { Injectable, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { normalizarCorreo } from '../common/normalizar-correo';

/**
 * Hay más de una cuenta cuyo correo solo difiere en mayúsculas o espacios.
 * No se elige ninguna: quien llama decide (login → 401 genérico, alta/edición → 409).
 */
export class CorreoDuplicadoError extends Error {
  constructor(readonly correo: string) {
    super(`Hay cuentas cuyo correo solo difiere en mayúsculas: ${correo}`);
    this.name = 'CorreoDuplicadoError';
  }
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.usersRepository.find({ order: { createdAt: 'ASC' } });
    return users.map(({ password, ...u }) => u);
  }

  /**
   * Busca sin distinguir mayúsculas: los correos viejos pueden estar guardados con
   * mayúsculas (no hubo migración). Si dos cuentas coinciden, lanza CorreoDuplicadoError.
   */
  async findByEmail(email: string): Promise<User | null> {
    const correo = normalizarCorreo(email);
    if (!correo) return null;
    const encontrados = await this.usersRepository
      .createQueryBuilder('u')
      .where('LOWER(TRIM(u.email)) = :correo', { correo })
      .take(2)
      .getMany();
    if (encontrados.length > 1) {
      this.logger.warn(`Hay cuentas cuyo correo solo difiere en mayúsculas: ${correo}; resuélvelo a mano`);
      throw new CorreoDuplicadoError(correo);
    }
    return encontrados[0] ?? null;
  }

  /** ¿El correo ya lo usa otra cuenta? Un duplicado cuenta como "ya registrado" */
  private async correoOcupado(email: string, excluirId?: number): Promise<boolean> {
    try {
      const existente = await this.findByEmail(email);
      return !!existente && existente.id !== excluirId;
    } catch (e) {
      if (e instanceof CorreoDuplicadoError) return true;
      throw e;
    }
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(nombre: string, email: string, password: string, rol: string = UserRole.SCOUT): Promise<User> {
    if (await this.correoOcupado(email)) throw new ConflictException('El correo ya está registrado');
    const hash = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({ nombre, email, password: hash, rol });
    return this.usersRepository.save(user);
  }

  async update(id: number, data: { nombre?: string; email?: string; password?: string; rol?: string; activo?: boolean }): Promise<Omit<User, 'password'>> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Cambiar solo las mayúsculas del propio correo no choca consigo mismo
    if (data.email && normalizarCorreo(data.email) !== normalizarCorreo(user.email)) {
      if (await this.correoOcupado(data.email, id)) throw new ConflictException('El correo ya está registrado');
    }

    const update: Partial<User> = {};
    if (data.nombre) update.nombre = data.nombre;
    if (data.email) update.email = data.email;
    if (data.rol) update.rol = data.rol;
    if (data.activo !== undefined) update.activo = data.activo;
    if (data.password) update.password = await bcrypt.hash(data.password, 10);

    await this.usersRepository.update(id, update);
    const updated = await this.findById(id);
    const { password, ...result } = updated;
    return result;
  }

  async seedUsers(): Promise<void> {
    const seeds = [
      // ── Administración ───────────────────────────────────────
      { nombre: 'Administrador',                    email: 'a@b.com',                        rol: UserRole.ADMINISTRADOR },

      // ── Grupo ────────────────────────────────────────────────
      { nombre: 'Maria Elena Padilla Hernández',    email: 'mariapadilla@scouts.mx',          rol: UserRole.JEFE_GRUPO },
      { nombre: 'Ethel Joyarit Vargas Silva',       email: 'ethelvargas@scouts.mx',           rol: UserRole.COLABORADOR_GRUPO },

      // ── Manada ───────────────────────────────────────────────
      { nombre: 'Janin',                            email: 'janin@scouts.mx',                 rol: UserRole.JEFE_MANADA },
      { nombre: 'Kevin',                            email: 'kevin@scouts.mx',                 rol: UserRole.SUB_JEFE_MANADA },

      // ── Tropa ────────────────────────────────────────────────
      { nombre: 'Jahir',                            email: 'jahir@scouts.mx',                 rol: UserRole.JEFE_TROPA },

      // ── Comunidad ────────────────────────────────────────────
      { nombre: 'Mario Eduardo Sánchez Mejía',      email: 'mario@scouts.mx',        rol: UserRole.JEFE_COMUNIDAD },
      { nombre: 'Felipe de Jesús Sánchez Mejía',   email: 'felipesanchez@scouts.mx',          rol: UserRole.SUB_JEFE_COMUNIDAD },

      // ── Clan ─────────────────────────────────────────────────
      { nombre: 'Gabriela',                         email: 'gabriela@scouts.mx',              rol: UserRole.JEFE_CLAN },
    ];

    for (const s of seeds) {
      let existing: User | null;
      try {
        existing = await this.findByEmail(s.email);
      } catch (e) {
        // Que una cuenta duplicada no tumbe el arranque del backend
        if (e instanceof CorreoDuplicadoError) {
          this.logger.warn(`Cuenta base omitida por correo duplicado: ${e.correo}`);
          continue;
        }
        throw e;
      }
      if (!existing) {
        // Sin contraseñas en el código (el repo es público): se crea con una
        // aleatoria y el administrador la cambia/comparte de forma privada
        await this.create(s.nombre, s.email, randomBytes(18).toString('base64url'), s.rol);
        console.log(`✅ Usuario creado (contraseña aleatoria; cámbiala desde la cuenta admin): ${s.email}`);
      } else if (existing.rol !== s.rol) {
        await this.usersRepository.update(existing.id, { rol: s.rol });
        console.log(`✅ Rol actualizado (${s.rol}): ${s.email}`);
      }
    }
  }
}
