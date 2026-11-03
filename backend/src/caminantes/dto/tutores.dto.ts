import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class TutorDto {
  @IsString() @MaxLength(150)
  nombre: string;

  @IsOptional() @IsString() @MaxLength(40)
  parentesco?: string;

  @IsOptional() @IsString() @MaxLength(30)
  telefono?: string;

  @IsOptional() @IsEmail()
  email?: string;
}

/** Reemplaza la lista completa de tutores de un joven (máximo 2) */
export class GuardarTutoresDto {
  @IsArray() @ArrayMaxSize(2, { message: 'Máximo 2 tutores por joven' })
  @ValidateNested({ each: true }) @Type(() => TutorDto)
  tutores: TutorDto[];
}
