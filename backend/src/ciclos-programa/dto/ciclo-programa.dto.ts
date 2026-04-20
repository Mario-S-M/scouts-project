import { IsString, IsInt, IsIn, IsArray, IsOptional, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ActividadCicloDto {
  @IsString()
  fechaSabado: string; // 'YYYY-MM-DD'

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  ejeTematico?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsInt()
  orden: number;
}

export class CrearCicloDto {
  @IsString()
  nombre: string;

  @IsInt()
  @Min(1)
  @Max(12)
  mesInicio: number;

  @IsInt()
  anio: number;

  @IsIn(['trimestral', 'cuatrimestral'])
  tipo: 'trimestral' | 'cuatrimestral';

  @IsString()
  seccion: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActividadCicloDto)
  actividades: ActividadCicloDto[];
}
