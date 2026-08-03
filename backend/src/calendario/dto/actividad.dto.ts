import { IsString, IsIn, IsOptional, MaxLength } from 'class-validator';
import { SeccionActividad } from '../entities/actividad.entity';

const SECCIONES: SeccionActividad[] = ['general', 'manada', 'tropa', 'comunidad', 'clan'];

export class CrearActividadDto {
  @IsString()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @IsString()
  fecha: string; // 'YYYY-MM-DD'

  @IsOptional()
  @IsString()
  hora?: string; // 'HH:mm'

  @IsOptional()
  @IsString()
  @MaxLength(200)
  lugar?: string;

  @IsIn(SECCIONES)
  seccion: SeccionActividad;
}

export class ActualizarActividadDto extends CrearActividadDto {}
