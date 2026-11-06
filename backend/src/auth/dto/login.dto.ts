import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NormalizarCorreo } from '../../common/normalizar-correo';

export class LoginDto {
  @NormalizarCorreo()
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(254, { message: 'El correo no puede tener más de 254 caracteres' })
  email: string;

  @IsString({ message: 'La contraseña debe ser texto' })
  @IsNotEmpty({ message: 'Escribe tu contraseña' })
  @MaxLength(128, { message: 'La contraseña no puede tener más de 128 caracteres' })
  password: string;
}
