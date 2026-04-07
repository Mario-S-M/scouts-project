import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { TipoEvidencia, EtapaEvidencia } from '../entities/evidencia.entity';

export class CreateEvidenciaDto {
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  caminanteId: number;

  @IsEnum(['sendero', 'especialidad', 'aventura', 'iniciativa', 'evento', 'puntaDeFlecha'])
  tipo: TipoEvidencia;

  @IsString()
  categoria: string;

  @IsOptional()
  @IsString()
  subcategoria?: string;

  @IsOptional()
  @IsEnum(['conozco', 'aplico', 'comparto', 'participacion', 'certificacion'])
  etapa?: EtapaEvidencia;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class ValidarEvidenciaDto {
  @IsEnum(['aprobada', 'rechazada'])
  estado: 'aprobada' | 'rechazada';

  @IsOptional()
  @IsString()
  comentarioValidador?: string;

  @IsOptional()
  @IsString()
  validadoPor?: string;
}
