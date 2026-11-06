import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';
import { NormalizarCorreo } from '../../common/normalizar-correo';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @NormalizarCorreo()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  rol?: string;
}
