import {
  IsString,
  IsInt,
  IsArray,
  IsOptional,
  IsDateString,
  ValidateNested,
  ArrayContains,
  ArrayNotEmpty,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import {
  ComponenteKit,
  COMPONENTES_KIT,
  COMPONENTE_KIT_OBLIGATORIO,
} from '../entities/solicitud-insignias-linea.entity';

/** Una línea de la solicitud: ítem del catálogo + cantidad */
export class LineaSolicitudInsigniasDto {
  @IsInt()
  catalogoItemId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  /**
   * Solo aplica al kit de pañoleta. Si viene, debe incluir 'motas'.
   * La validación de que la categoría sea kit_panoleta se hace en el servicio,
   * porque aquí solo se conoce el id del ítem, no su categoría.
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(COMPONENTES_KIT, { each: true })
  @ArrayContains([COMPONENTE_KIT_OBLIGATORIO], {
    message: 'El kit de pañoleta siempre debe incluir las motas',
  })
  componentesKit?: ComponenteKit[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notas?: string;
}

/**
 * Alta de una solicitud. No se capturan ni `seccion` (se copia de
 * caminante.seccion) ni `solicitanteId` (sale de req.user.id).
 */
export class CrearSolicitudInsigniasDto {
  @IsInt()
  caminanteId: number;

  @IsOptional()
  @IsDateString()
  fecha?: string; // 'YYYY-MM-DD'

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineaSolicitudInsigniasDto)
  lineas: LineaSolicitudInsigniasDto[];
}

/** Edición de una solicitud: todos los campos son opcionales */
export class ActualizarSolicitudInsigniasDto extends PartialType(
  CrearSolicitudInsigniasDto,
) {}
