export type SeccionActividad = 'general' | 'manada' | 'tropa' | 'comunidad' | 'clan';

export interface Actividad {
  id: number;
  titulo: string;
  descripcion?: string;
  fecha: string; // 'YYYY-MM-DD'
  hora?: string; // 'HH:mm:ss'
  lugar?: string;
  seccion: SeccionActividad;
  creadoPorId: number;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface CrearActividadDto {
  titulo: string;
  descripcion?: string;
  fecha: string;
  hora?: string;
  lugar?: string;
  seccion: SeccionActividad;
}

export const SECCIONES_ACTIVIDAD: { value: SeccionActividad; label: string }[] = [
  { value: 'general',   label: 'General (toda la comunidad)' },
  { value: 'manada',    label: 'Manada de Lobatos' },
  { value: 'tropa',     label: 'Tropa de Scouts' },
  { value: 'comunidad', label: 'Comunidad de Caminantes' },
  { value: 'clan',      label: 'Clan de Rovers' },
];

export const SECCION_COLOR: Record<SeccionActividad, string> = {
  general:   '#7C3AED',
  manada:    '#D97706',
  tropa:     '#16A34A',
  comunidad: '#2563EB',
  clan:      '#DC2626',
};
