import {
  IsString, IsInt, IsOptional, IsArray,
  ValidateNested, IsIn, IsNumber, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AltaBajaDto {
  @IsIn(['alta', 'baja'])
  tipo: 'alta' | 'baja';

  @IsOptional() @IsString()
  cum?: string;

  @IsString()
  nombre: string;

  @IsInt()
  orden: number;
}

export class AsistenciaActividadDto {
  @IsOptional() @IsString()
  fecha?: string;

  @IsString()
  actividad: string;

  @IsInt()
  asistencia: number;

  @IsOptional() @IsString()
  observaciones?: string;

  @IsInt()
  orden: number;
}

export class ActividadPendienteDto {
  @IsString()
  actividad: string;

  @IsOptional() @IsString()
  observaciones?: string;

  @IsInt()
  orden: number;
}

export class MovimientoFinancieroDto {
  @IsIn(['ingreso', 'egreso'])
  tipo: 'ingreso' | 'egreso';

  @IsOptional() @IsString()
  fecha?: string;

  @IsString()
  concepto: string;

  @IsNumber()
  cantidad: number;

  @IsInt()
  orden: number;
}

export class InventarioItemDto {
  @IsOptional() @IsInt()
  id?: number;

  @IsOptional() @IsInt()
  anioCompra?: number;

  @IsOptional() @IsString()
  marca?: string;

  @IsString()
  descripcion: string;

  @IsInt()
  cantidad: number;

  @IsOptional() @IsString()
  observaciones?: string;
}

export class ProgresionInformeDto {
  @IsString()
  descripcion: string;

  @IsString()
  nombre: string;

  @IsOptional() @IsString()
  actividadNombre?: string;

  @IsOptional() @IsString()
  fecha?: string;

  @IsInt()
  orden: number;
}

export class CrearInformeDto {
  @IsInt() @Min(1) @Max(12)
  mes: number;

  @IsInt()
  anio: number;

  @IsString()
  seccion: string;

  // Membresía
  @IsInt()
  totalRegistrados: number;

  @IsInt()
  totalEnlace: number;

  @IsInt()
  totalCaptacion: number;

  @IsInt()
  totalNoRegistrados: number;

  // Caja chica
  @IsNumber()
  saldoInicial: number;

  @IsOptional() @IsString()
  observacionesGenerales?: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => AltaBajaDto)
  altasBajas: AltaBajaDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => AsistenciaActividadDto)
  actividades: AsistenciaActividadDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => ActividadPendienteDto)
  actividadesPendientes: ActividadPendienteDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => MovimientoFinancieroDto)
  movimientos: MovimientoFinancieroDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => ProgresionInformeDto)
  progresiones: ProgresionInformeDto[];
}

export class InventarioItemCrudDto {
  @IsString()
  seccion: string;

  @IsOptional() @IsInt()
  anioCompra?: number;

  @IsOptional() @IsString()
  marca?: string;

  @IsString()
  descripcion: string;

  @IsInt()
  cantidad: number;

  @IsOptional() @IsString()
  observaciones?: string;
}
