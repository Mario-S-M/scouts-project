import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import {
  SECCIONES_ACTIVIDAD, SeccionActividad, TIPOS_ACTIVIDAD, TipoActividad, VISIBILIDADES, Visibilidad,
} from '../entities/actividad.entity';

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

  /** Compatibilidad con el formulario anterior: una sola sección o 'general' */
  @IsOptional()
  @IsIn(SECCIONES)
  seccion?: SeccionActividad;

  /** Secciones de la actividad (o ['grupo'] para todo el grupo) */
  @IsOptional()
  @IsArray() @ArrayNotEmpty()
  @IsIn(SECCIONES_ACTIVIDAD as unknown as string[], { each: true })
  secciones?: string[];

  @IsOptional()
  @IsIn(TIPOS_ACTIVIDAD as unknown as string[])
  tipo?: TipoActividad;

  @IsOptional()
  @IsIn(VISIBILIDADES as unknown as string[])
  visibilidad?: Visibilidad;
}

/** Alta de varias actividades a la vez (lo que se confirma tras una reunión) */
export class CrearActividadesLoteDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => CrearActividadDto)
  actividades: CrearActividadDto[];
}

/** Envío por Telegram a cada scouter de las actividades indicadas */
export class NotificarActividadesDto {
  @IsArray() @ArrayNotEmpty()
  ids: number[];
}

export class ActualizarActividadDto extends CrearActividadDto {}
