import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.usersRepository.find({ order: { createdAt: 'ASC' } });
    return users.map(({ password, ...u }) => u);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(nombre: string, email: string, password: string, rol: string = UserRole.SCOUT): Promise<User> {
    const exists = await this.findByEmail(email);
    if (exists) throw new ConflictException('El correo ya está registrado');
    const hash = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({ nombre, email, password: hash, rol });
    return this.usersRepository.save(user);
  }

  async update(id: number, data: { nombre?: string; email?: string; password?: string; rol?: string; activo?: boolean }): Promise<Omit<User, 'password'>> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (data.email && data.email !== user.email) {
      const exists = await this.findByEmail(data.email);
      if (exists) throw new ConflictException('El correo ya está en uso');
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
      { nombre: 'Administrador',                    email: 'a@b.com',                        password: 'admin123',   rol: UserRole.JEFE_GRUPO },

      // ── Grupo ────────────────────────────────────────────────
      { nombre: 'Maria Elena Padilla Hernández',    email: 'mariapadilla@scouts.mx',          password: 'scouts123',  rol: UserRole.JEFE_GRUPO },
      { nombre: 'Ethel Joyarit Vargas Silva',       email: 'ethelvargas@scouts.mx',           password: 'scouts123',  rol: UserRole.COLABORADOR_GRUPO },

      // ── Manada ───────────────────────────────────────────────
      { nombre: 'Janin',                            email: 'janin@scouts.mx',                 password: 'scouts123',  rol: UserRole.JEFE_MANADA },
      { nombre: 'Kevin',                            email: 'kevin@scouts.mx',                 password: 'scouts123',  rol: UserRole.SUB_JEFE_MANADA },

      // ── Tropa ────────────────────────────────────────────────
      { nombre: 'Jahir',                            email: 'jahir@scouts.mx',                 password: 'scouts123',  rol: UserRole.JEFE_TROPA },

      // ── Comunidad ────────────────────────────────────────────
      { nombre: 'Mario Eduardo Sánchez Mejía',      email: 'mario@scouts.mx',        password: 'scouts123',   rol: UserRole.JEFE_COMUNIDAD },
      { nombre: 'Felipe de Jesús Sánchez Mejía',   email: 'felipesanchez@scouts.mx',          password: 'scouts123',  rol: UserRole.SUB_JEFE_COMUNIDAD },

      // ── Clan ─────────────────────────────────────────────────
      { nombre: 'Gabriela',                         email: 'gabriela@scouts.mx',              password: 'scouts123',  rol: UserRole.JEFE_CLAN },
    ];

    for (const s of seeds) {
      const existing = await this.findByEmail(s.email);
      if (!existing) {
        await this.create(s.nombre, s.email, s.password, s.rol);
        console.log(`✅ Usuario creado: ${s.email}`);
      } else if (existing.rol !== s.rol) {
        await this.usersRepository.update(existing.id, { rol: s.rol });
        console.log(`✅ Rol actualizado (${s.rol}): ${s.email}`);
      }
    }
  }
}
