export type SeccionActividad = 'general' | 'manada' | 'tropa' | 'comunidad' | 'clan';
export type TipoActividad = 'consejo' | 'salida' | 'pase' | 'grupal' | 'reunion';
/** publica: todo el grupo (jóvenes incluidos) · seccion: sus secciones · scouters: solo scouters */
export type Visibilidad = 'publica' | 'seccion' | 'scouters';

export interface Actividad {
  id: number;
  titulo: string;
  descripcion?: string;
  fecha: string; // 'YYYY-MM-DD'
  hora?: string; // 'HH:mm:ss'
  lugar?: string;
  seccion: SeccionActividad;
  /** manada, tropa, comunidad, clan o ['grupo'] = todo el grupo */
  secciones: string[];
  tipo: TipoActividad;
  visibilidad: Visibilidad;
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
  secciones: string[];
  tipo: TipoActividad;
  visibilidad: Visibilidad;
}

export const TIPOS_ACTIVIDAD: { value: TipoActividad; label: string; emoji: string }[] = [
  { value: 'consejo', label: 'Consejo / junta de scouters', emoji: '🧭' },
  { value: 'salida',  label: 'Salida / campamento / aventura', emoji: '🏕️' },
  { value: 'pase',    label: 'Pase / ceremonia', emoji: '🎖️' },
  { value: 'grupal',  label: 'Actividad grupal', emoji: '🤝' },
  { value: 'reunion', label: 'Reunión / servicio / otra', emoji: '📌' },
];

export const VISIBILIDADES: { value: Visibilidad; label: string; icon: string }[] = [
  { value: 'publica',  label: 'Todo el grupo', icon: 'pi pi-globe' },
  { value: 'seccion',  label: 'Solo su sección', icon: 'pi pi-users' },
  { value: 'scouters', label: 'Solo scouters', icon: 'pi pi-lock' },
];

/** Opciones de secciones de una actividad */
export const SECCIONES_MULTI: { value: string; label: string }[] = [
  { value: 'grupo',     label: 'Todo el grupo' },
  { value: 'manada',    label: 'Manada' },
  { value: 'tropa',     label: 'Tropa' },
  { value: 'comunidad', label: 'Comunidad' },
  { value: 'clan',      label: 'Clan' },
];

export const SECCIONES_ACTIVIDAD: { value: SeccionActividad; label: string }[] = [
  { value: 'general',   label: 'Todo el grupo' },
  { value: 'manada',    label: 'Manada de Lobatos' },
  { value: 'tropa',     label: 'Tropa de Scouts' },
  { value: 'comunidad', label: 'Comunidad de Caminantes' },
  { value: 'clan',      label: 'Clan de Rovers' },
];

export const SECCION_COLOR: Record<string, string> = {
  general:   '#7C3AED',
  grupo:     '#7C3AED',
  manada:    '#D97706',
  tropa:     '#16A34A',
  comunidad: '#2563EB',
  clan:      '#DC2626',
};
