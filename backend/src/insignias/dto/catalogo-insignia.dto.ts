import {
  IsString,
  IsIn,
  IsInt,
  IsOptional,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import {
  CategoriaCatalogo,
  CATEGORIAS_CATALOGO,
} from '../entities/catalogo-insignia.entity';

/** Alta de un ítem del catálogo de insignias solicitables */
export class CrearCatalogoInsigniaDto {
  @IsIn(CATEGORIAS_CATALOGO)
  categoria: CategoriaCatalogo;

  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  claveProgreso?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** Edición de un ítem del catálogo: todos los campos son opcionales */
export class ActualizarCatalogoInsigniaDto extends PartialType(
  CrearCatalogoInsigniaDto,
) {}
