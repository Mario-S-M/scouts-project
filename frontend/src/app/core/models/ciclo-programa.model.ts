export type TipoCiclo = 'trimestral' | 'cuatrimestral';

export interface ActividadCiclo {
  id?: number;
  cicloId?: number;
  fechaSabado: string; // 'YYYY-MM-DD'
  nombre: string;
  ejeTematico: string;
  descripcion?: string;
  orden: number;
}

export interface CicloPrograma {
  id: number;
  nombre: string;
  mesInicio: number;
  anio: number;
  tipo: TipoCiclo;
  seccion: string;
  creadoPorId: number;
  creadoPor?: { id: number; nombre: string };
  actividades: ActividadCiclo[];
  createdAt: string;
}

export interface CrearCicloDto {
  nombre: string;
  mesInicio: number;
  anio: number;
  tipo: TipoCiclo;
  seccion: string;
  actividades: ActividadCiclo[];
}

// ── Ejes Temáticos del Nuevo Programa Scouts de México ─────────────────────
export const EJES_TEMATICOS = [
  'Habilidades para la Vida',
  'Salud y Bienestar',
  'Medio Ambiente y Sustentabilidad',
  'Paz y Acción Comunitaria',
];

export const EJE_COLOR: Record<string, { bg: string; text: string }> = {
  'Habilidades para la Vida':          { bg: '#DBEAFE', text: '#1E40AF' },
  'Salud y Bienestar':                 { bg: '#D1FAE5', text: '#065F46' },
  'Medio Ambiente y Sustentabilidad':  { bg: '#D1FAE5', text: '#166534' },
  'Paz y Acción Comunitaria':          { bg: '#FEF3C7', text: '#92400E' },
};

export const MESES_NOMBRES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Genera todos los sábados en el rango del ciclo */
export function getSabadosDeCiclo(mesInicio: number, anio: number, tipo: TipoCiclo): string[] {
  const meses = tipo === 'trimestral' ? 3 : 4;
  const sabados: string[] = [];

  const start = new Date(anio, mesInicio - 1, 1);
  const end   = new Date(anio, mesInicio - 1 + meses, 0); // last day of last month

  const d = new Date(start);
  // Advance to first Saturday (day 6)
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() + 1);
  }
  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    sabados.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 7);
  }
  return sabados;
}
