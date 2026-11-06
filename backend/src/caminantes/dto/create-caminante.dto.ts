import { IsString, IsOptional, IsEmail, IsDateString } from 'class-validator';
import { NormalizarCorreo } from '../../common/normalizar-correo';

export class CreateCaminanteDto {
  @IsString()
  nombre: string;

  @IsString()
  apellidos: string;

  // Datos del grupo; si no vienen se usan los del Grupo 7 (ver caminantes.service)
  @IsOptional() @IsString()
  grupo?: string;

  @IsOptional() @IsString()
  provincia?: string;

  /** Nombre del grupo ("Itsï Tarhiata"), no la sección */
  @IsOptional() @IsString()
  comunidad?: string;

  @IsOptional()
  @IsString()
  seccion?: string;

  @IsOptional()
  @IsString()
  equipo?: string;

  @IsOptional()
  @IsDateString()
  fechaPromesa?: string;

  @IsOptional()
  @IsDateString()
  fechaPaseInicio?: string;

  @IsOptional()
  @NormalizarCorreo()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  cum?: string;

  @IsOptional()
  @IsString()
  foto?: string;
}
