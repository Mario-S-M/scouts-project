/**
 * Formato de fechas y horas de los avisos. Las fechas llegan como 'YYYY-MM-DD',
 * 'YYYY-MM-DDT12:00:00' (MCP) o ISO con Z (formulario Angular); las horas como
 * 'HH:mm' o ISO. Todo se muestra en hora de Michoacán, sin depender de la zona
 * horaria del contenedor.
 */
const TZ = 'America/Mexico_City';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Día calendario [año, mes 1-12, día] de una fecha del aviso */
function partesFecha(s?: string | null): [number, number, number] | null {
  if (!s) return null;
  const solo = /^(\d{4})-(\d{2})-(\d{2})(?:T(?!.*Z$)|$)/.exec(s);
  if (solo) return [+solo[1], +solo[2], +solo[3]];
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const [y, m, dd] = d.toLocaleDateString('en-CA', { timeZone: TZ }).split('-').map(Number);
  return [y, m, dd];
}

export function fechaCorta(s?: string | null): string {
  const p = partesFecha(s);
  return p ? `${String(p[2]).padStart(2, '0')}/${String(p[1]).padStart(2, '0')}/${p[0]}` : '';
}

/** "Sábado 14 de noviembre de 2026" */
export function fechaLarga(s?: string | null): string {
  const p = partesFecha(s);
  if (!p) return '';
  const dia = new Date(p[0], p[1] - 1, p[2], 12).getDay();
  return `${DIAS[dia]} ${p[2]} de ${MESES[p[1] - 1]} de ${p[0]}`;
}

/** "7:30 a.m." */
export function hora(s?: string | null): string {
  if (!s) return '';
  let h: number, m: number;
  const hhmm = /^(\d{1,2}):(\d{2})/.exec(s);
  if (hhmm) {
    h = +hhmm[1]; m = +hhmm[2];
  } else {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    [h, m] = d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).split(':').map(Number);
  }
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'p.m.' : 'a.m.'}`;
}

/** "14/11/2026, 7:30 a.m." (lo que pide el protocolo en cada casilla) */
export function fechaHora(fecha?: string | null, h?: string | null): string {
  return [fechaCorta(fecha), hora(h)].filter(Boolean).join(', ');
}
