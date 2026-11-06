import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CorreoDuplicadoError, UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    // Mismo 401 genérico para correo inexistente, duplicado, inactivo o contraseña mala:
    // la respuesta no revela qué correos existen
    let user: User | null;
    try {
      user = await this.usersService.findByEmail(email);
    } catch (e) {
      if (e instanceof CorreoDuplicadoError) throw new UnauthorizedException('Credenciales inválidas');
      throw e;
    }
    if (!user || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload = { sub: user.id, email: user.email, rol: user.rol, nombre: user.nombre };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        // Jóvenes: su sección (para colores y vocabulario); scouters: la de su rol
        seccion: user.seccion ?? null,
      },
    };
  }
}
