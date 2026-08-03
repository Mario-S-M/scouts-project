import { IsInt, IsString, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class ActualizarConfiguracionRecordatorioDto {
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @IsString()
  hora: string; // 'HH:mm'

  @IsOptional()
  @IsBoolean()
  habilitado?: boolean;
}
