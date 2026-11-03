/**
 * Enlaces wa.me sin número: abren WhatsApp con el texto ya escrito y Mario
 * elige el grupo de papás. Los enlaces de invitación de grupo no admiten texto.
 */

const MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function enlaceWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function fechaLarga(s?: string | null): string {
  if (!s) return '';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return s;
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth() + 1]}`;
}

function hora(s?: string | null): string {
  if (!s) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (m) {
    const h = Number(m[1]);
    return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'p.m.' : 'a.m.'}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
}

export function mensajeAviso(aviso: any, link: string | null, extra?: string): string {
  const d = aviso.data ?? aviso;
  const lineas = [
    `🏕️ *Aviso de salida: ${d.nombre ?? aviso.nombre}*`,
    d.tipo ? `Tipo: ${d.tipo}` : '',
    '',
    d.salida?.fecha ? `🚩 *Salida:* ${fechaLarga(d.salida.fecha.slice(0, 10))}${d.salida.hora ? `, ${hora(d.salida.hora)}` : ''}${d.salida.lugar ? ` en ${d.salida.lugar}` : ''}` : '',
    d.llegada?.fecha ? `🏁 *Regreso:* ${fechaLarga(d.llegada.fecha.slice(0, 10))}${d.llegada.hora ? `, ${hora(d.llegada.hora)}` : ''}${d.llegada.lugar ? ` en ${d.llegada.lugar}` : ''}` : '',
    d.lugarDescripcion ? `📍 *Lugar:* ${d.lugarDescripcion}` : '',
    d.transporte ? `🚌 *Transporte:* ${d.transporte}` : '',
    d.costo ? `💵 *Costo:* $${d.costo}` : '',
    d.contactoActividad?.nombre ? `📞 *Contacto:* ${d.contactoActividad.nombre}${d.contactoActividad.telefono ? ` (${d.contactoActividad.telefono})` : ''}` : '',
    '',
    extra ?? '',
    link ? `📄 Aviso y permiso: ${link}` : '',
    '',
    'Por favor regresen el permiso firmado. ¡Siempre listos! ⚜️',
  ];
  return compactar(lineas);
}

export function mensajeCiclo(ciclo: any, link: string | null, extra?: string): string {
  const acts = [...(ciclo.actividades ?? [])].sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
  const lineas = [
    `📅 *Ciclo de programa: ${ciclo.nombre}*`,
    `${ciclo.tipo === 'cuatrimestral' ? 'Cuatrimestre' : 'Trimestre'} desde ${MESES[ciclo.mesInicio]} ${ciclo.anio}`,
    '',
    ...acts.map((a: any) => `• ${fechaLarga(a.fechaSabado)}: ${a.nombre || 'Actividad por definir'}${a.ejeTematico ? ` (${a.ejeTematico})` : ''}`),
    '',
    extra ?? '',
    link ? `📄 Programa completo: ${link}` : '',
    '',
    '¡Siempre listos! ⚜️',
  ];
  return compactar(lineas);
}

export function mensajeGenerico(titulo: string, cuerpo: string, link: string | null): string {
  return compactar([`*${titulo}*`, '', cuerpo, '', link ? `📄 ${link}` : '', '', '¡Siempre listos! ⚜️']);
}

/** Quita líneas vacías repetidas que dejan los campos opcionales */
function compactar(lineas: string[]): string {
  return lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
