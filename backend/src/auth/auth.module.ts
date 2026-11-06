import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // Solo lo usa POST /auth/login (sin APP_GUARD). Sin `name` para que la cabecera
    // salga como Retry-After a secas; ttl en milisegundos; almacenamiento en memoria.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 5 }],
      errorMessage: 'Demasiados intentos, espera un momento',
    }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'scouts_cc_secret_key',
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, RolesGuard, LoginThrottlerGuard],
  controllers: [AuthController],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
