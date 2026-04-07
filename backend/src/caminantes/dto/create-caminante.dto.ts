import { IsString, IsOptional, IsEmail, IsDateString } from 'class-validator';

export class CreateCaminanteDto {
  @IsString()
  nombre: string;

  @IsString()
  apellidos: string;

  @IsString()
  grupo: string;

  @IsString()
  provincia: string;

  @IsString()
  comunidad: string;

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
