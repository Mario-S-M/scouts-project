import { SeccionActividad } from './actividad.model';

export interface ConfiguracionRecordatorio {
  id: number;
  seccion: SeccionActividad;
  diaSemana: number; // 0=domingo ... 6=sábado
  hora: string; // 'HH:mm:ss'
  habilitado: boolean;
  ultimoEnvio: string | null;
  actualizadoPorId: number | null;
  fechaActualizacion: string;
}

export interface ActualizarConfiguracionRecordatorioDto {
  diaSemana: number;
  hora: string; // 'HH:mm'
  habilitado?: boolean;
}

export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
];
