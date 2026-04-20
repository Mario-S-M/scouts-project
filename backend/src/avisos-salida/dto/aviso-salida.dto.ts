import { Type } from 'class-transformer';
import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';

export class ContactoDto {
  @IsString() @IsOptional() nombre: string;
  @IsString() @IsOptional() cargo: string;
  @IsString() @IsOptional() telefono: string;
}

export class MovimientoDto {
  @IsString() @IsOptional() lugar: string;
  @IsString() @IsOptional() fecha: string;
  @IsString() @IsOptional() hora: string;
}

export class ParticipanteDto {
  @IsString() @IsOptional() nombre: string;
  @IsString() @IsOptional() apellidos: string;
  @IsString() @IsOptional() cum: string;
  @IsString() @IsOptional() fechaNacimiento: string;
  @IsString() @IsOptional() seccion: string;
}

export class ScouterDto {
  @IsString() @IsOptional() nombre: string;
  @IsString() @IsOptional() cum: string;
}

export class AvisoSalidaDto {
  @IsString() @IsOptional() tipo: string;
  @IsString() @IsOptional() nombre: string;

  @IsOptional() @ValidateNested() @Type(() => MovimientoDto)
  salida: MovimientoDto;

  @IsOptional() @ValidateNested() @Type(() => MovimientoDto)
  llegada: MovimientoDto;

  @IsString() @IsOptional() transporte: string;

  @IsOptional() @ValidateNested() @Type(() => ContactoDto)
  contactoLocal: ContactoDto;

  @IsOptional() @ValidateNested() @Type(() => ContactoDto)
  contactoActividad: ContactoDto;

  @IsString() @IsOptional() lugarDescripcion: string;

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => ParticipanteDto)
  participantes: ParticipanteDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => ScouterDto)
  scouters: ScouterDto[];

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => ScouterDto)
  invitados: ScouterDto[];

  @IsString() @IsOptional() mapUrl: string;

  @IsNumber() @IsOptional() costo?: number;
}
