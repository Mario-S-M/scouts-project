#!/usr/bin/env node
/**
 * Servidor MCP de Scouts CC. Expone la API de scouts-app como herramientas para
 * Claude Desktop / Claude Code: avisos de salida, informes mensuales, solicitudes
 * de insignias, ciclos de programa y consultas de apoyo. Los PDFs se guardan en
 * la carpeta de Drive del grupo y se arma el enlace wa.me para el grupo de papás.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { api, apiBinary, apiUpload, usuarioActual, API_URL } from './api.js';
import * as fsp from 'node:fs/promises';
import * as pathMod from 'node:path';
import { guardarEnDrive, carpetas } from './drive.js';
import { docxAPdf } from './convertir.js';
import { enlaceWhatsApp, mensajeAviso, mensajeCiclo, mensajeGenerico } from './whatsapp.js';

const server = new McpServer({ name: 'scouts-cc', version: '1.0.0' });

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type Resultado = { content: { type: 'text'; text: string }[]; isError?: boolean };

/** Campos que nunca deben llegar a Claude, vengan en el objeto que vengan */
const OCULTOS = new Set(['password', 'telegramChatId', 'telegramLinkCode', 'telegramLinkCodeExpira']);

function ok(data: unknown): Resultado {
  const text = typeof data === 'string'
    ? data
    : JSON.stringify(data, (k, v) => (OCULTOS.has(k) ? undefined : v), 2);
  return { content: [{ type: 'text', text }] };
}

/** Envuelve el handler para devolver los errores como texto legible para Claude */
function tool<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A): Promise<Resultado> => {
    try {
      return ok(await fn(args));
    } catch (e: any) {
      return { content: [{ type: 'text', text: `Error: ${e?.message ?? e}` }], isError: true };
    }
  };
}

async function publicar(subcarpetas: string[], archivo: string, pdf: Buffer, mensaje: (link: string | null) => string) {
  const guardado = await guardarEnDrive(subcarpetas, archivo, pdf);
  const texto = mensaje(guardado.link);
  return {
    archivo: guardado.ruta,
    enDrive: guardado.enDrive,
    linkDrive: guardado.link,
    nota: guardado.nota,
    mensajeWhatsApp: texto,
    enlaceWhatsApp: enlaceWhatsApp(texto),
    instrucciones: 'Abre enlaceWhatsApp y elige el grupo de papás para enviar el mensaje.',
  };
}

const LECTURA = { readOnlyHint: true, openWorldHint: false };
const ESCRITURA = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const PUBLICAR = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

const seccion = z.enum(['manada', 'tropa', 'comunidad', 'clan']).describe('Sección del grupo');
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Fecha YYYY-MM-DD');

// ── Consultas de apoyo ──────────────────────────────────────────────────────────
server.registerTool('quien_soy', {
  title: 'Usuario conectado',
  description: 'Muestra con qué cuenta y a qué servidor de scouts-app está conectado Claude.',
  inputSchema: {},
  annotations: LECTURA,
}, tool(async () => ({ servidor: API_URL, usuario: await usuarioActual() })));

server.registerTool('listar_caminantes', {
  title: 'Listar jóvenes',
  description: 'Lista los jóvenes de la sección (lobatos y lobeznas, scouts, caminantes o rovers) con su sección, CUM y fecha de nacimiento. Un scouter solo ve los de su sección. Úsalo para armar participantes de avisos o solicitudes.',
  inputSchema: { seccion: seccion.optional() },
  annotations: LECTURA,
}, tool(async ({ seccion }: { seccion?: string }) => {
  const todos: any[] = await api('GET', '/caminantes');
  return (seccion ? todos.filter(c => c.seccion === seccion) : todos)
    .map(c => ({ id: c.id, nombre: c.nombre, apellidos: c.apellidos, seccion: c.seccion, equipo: c.equipo, cum: c.cum, fechaNacimiento: c.fechaNacimiento, activo: c.activo }));
}));

server.registerTool('ver_caminante', {
  title: 'Ver joven',
  description: 'Detalle de un joven con sus papás/tutores y, si su sección usa progresión (Comunidad), su progreso.',
  inputSchema: { id: z.number().int() },
  annotations: LECTURA,
}, tool(async ({ id }: { id: number }) => {
  const caminante: any = await api('GET', `/caminantes/${id}`);
  const tutores = await api('GET', `/caminantes/${id}/tutores`);
  const progreso = caminante.seccion === 'comunidad' ? await api('GET', `/caminantes/${id}/progreso`) : undefined;
  return { caminante, tutores, progreso };
}));

server.registerTool('listar_staff', {
  title: 'Listar staff',
  description: 'Dirigentes (todo usuario que no es scout) con id, nombre y rol. Útil para contactos y scouters de un aviso.',
  inputSchema: {},
  annotations: LECTURA,
}, tool(() => api('GET', '/avisos-salida/staff')));

server.registerTool('calendario_mes', {
  title: 'Calendario del mes',
  description: 'Actividades del calendario del grupo en un mes.',
  inputSchema: { anio: z.number().int(), mes: z.number().int().min(1).max(12) },
  annotations: LECTURA,
}, tool(({ anio, mes }: { anio: number; mes: number }) => api('GET', `/calendario/mes/${anio}/${mes}`)));

server.registerTool('dashboard', {
  title: 'Estadísticas',
  description: 'Estadísticas generales de la app (dashboard).',
  inputSchema: {},
  annotations: LECTURA,
}, tool(() => api('GET', '/dashboard/stats')));

// ── Avisos de salida ────────────────────────────────────────────────────────────
/** Scouters que van por defecto en los avisos; SCOUTS_SCOUTERS_DEFAULT los cambia (separados por coma) */
const SCOUTERS_DEFAULT = (process.env.SCOUTS_SCOUTERS_DEFAULT || 'Mario Eduardo Sánchez Mejía,Felipe de Jesús Sánchez Mejía')
  .split(',').map(s => s.trim()).filter(Boolean);

/** Misma tabla que backend/src/common/rol-seccion.util.ts; null = roles de grupo (todas las secciones) */
function seccionDeRol(rol: string): string | null {
  const m = /^(?:sub_)?jefe_(manada|tropa|comunidad|clan)$/.exec(rol);
  return m ? m[1] : null;
}

const movimiento = z.object({
  lugar: z.string().optional(),
  fecha: fecha.optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Hora HH:mm (24 h)'),
});
const contacto = z.object({ nombre: z.string().optional(), cargo: z.string().optional(), telefono: z.string().optional() });
const persona = z.object({ nombre: z.string(), cum: z.string().optional() });
const fechaHora = z.object({ fecha: fecha.optional(), hora: z.string().regex(/^\d{2}:\d{2}$/).optional() });
const vuelo = z.object({ aerolinea: z.string().optional(), aeropuerto: z.string().optional(), vuelo: z.string().optional(), fecha: fecha.optional(), hora: z.string().optional() });
const protocoloSchema = z.object({
  coordinador: z.object({ nombre: z.string().optional(), cargo: z.string().optional(), telLocal: z.string().optional(), celular: z.string().optional() }).optional()
    .describe('Coordinador de seguridad: se queda en Morelia, NO asiste. Por defecto el de siempre'),
  enlace: z.object({ nombre: z.string().optional(), cargo: z.string().optional(), celular1: z.string().optional(), celular2: z.string().optional() }).optional()
    .describe('Enlace de seguridad: SÍ viaja. Por defecto el de siempre'),
  llegadaDestino: fechaHora.optional().describe('Llegada estimada al lugar del evento'),
  llegadaOrigen: fechaHora.optional().describe('Llegada estimada de vuelta a Morelia'),
  transporte: z.enum(['autobus', 'contratado', 'particular', 'aereo']).optional().describe('Por defecto autobus (autobús de línea)'),
  autobus: z.object({
    lineaSalida: z.string().optional(), lineaRegreso: z.string().optional(),
    salidaFecha: fecha.optional(), salidaHora: z.string().optional(),
    regresoFecha: fecha.optional(), regresoHora: z.string().optional(),
    trasladoTerminal: z.string().optional().describe('Cómo van de la terminal de destino al lugar del evento'),
  }).optional(),
  contratado: z.object({
    empresa: z.string().optional(), telefonos: z.string().optional(), marcaModelo: z.string().optional(), placas: z.string().optional(), operador: z.string().optional(),
    documentos: z.object({ contrato: z.boolean().optional(), feMecanica: z.boolean().optional(), seguroViajero: z.boolean().optional(), licencia: z.boolean().optional(), tarjetaCirculacion: z.boolean().optional() }).optional(),
  }).optional(),
  particular: z.object({
    marca: z.string().optional(), modelo: z.string().optional(), anio: z.string().optional(), capacidad: z.string().optional(), placas: z.string().optional(), color: z.string().optional(),
    conductor: z.string().optional(), licencia: z.string().optional(), expedidaPor: z.string().optional(),
    documentos: z.object({ poliza: z.boolean().optional(), licencia: z.boolean().optional(), tarjetaCirculacion: z.boolean().optional() }).optional(),
  }).optional(),
  aereo: z.object({ salida: vuelo.optional(), regreso: vuelo.optional(), trasladoDestino: z.string().optional(), trasladoOrigen: z.string().optional() }).optional(),
});

/** Mezcla profunda: lo de `b` gana, pero no borra lo que `a` ya tenía */
function mezclar(a: any, b: any): any {
  if (b === undefined) return a;
  if (!a || typeof a !== 'object' || !b || typeof b !== 'object' || Array.isArray(b)) return b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = mezclar(a[k], v);
  return out;
}

const avisoSchema = {
  seccion: z.enum(['manada', 'tropa', 'comunidad', 'clan', 'grupo']).optional()
    .describe('Sección dueña del aviso. "grupo" = salida de TODO el grupo (la ven todas las secciones; la crean el administrador o la jefatura de grupo). Un scouter de sección usa siempre la suya; el administrador debe indicarla al crear'),
  tipo: z.enum(['Excursión', 'Campamento', 'Hike', 'Actividad de Sección', 'Reunión Intergrupal', 'Evento Provincial', 'Jamboree', 'Otro']),
  nombre: z.string().describe('Nombre de la actividad'),
  salida: movimiento,
  llegada: movimiento,
  transporte: z.string().optional(),
  contactoLocal: contacto.optional().describe('Contacto que se queda en la ciudad'),
  contactoActividad: contacto.optional().describe('Contacto responsable en la actividad'),
  lugarDescripcion: z.string().optional(),
  mapUrl: z.string().optional(),
  costo: z.number().optional(),
  participantesIds: z.array(z.number().int()).optional().describe('Ids de caminantes (de listar_caminantes); el servidor completa nombre, CUM, fecha de nacimiento y sección. Si se omite van TODOS los caminantes activos de la sección del usuario; manda ids solo si el usuario pide excluir o elegir a algunos'),
  scouters: z.array(persona).optional().describe(`Dirigentes que asisten. Si se omite van los de por defecto (${SCOUTERS_DEFAULT.join(' y ')}); manda la lista solo si el usuario pide otros`),
  invitados: z.array(persona).optional(),
  protocolo: protocoloSchema.optional().describe('Protocolo de seguridad en el traslado (formato CNAR). SIEMPRE se llena: coordinador, enlace y transporte vienen por defecto; pregunta al usuario lo que falte (llegadas estimadas, línea de autobús y horarios, cómo van de la terminal al lugar, etc.)'),
};
type AvisoArgs = { [K in keyof typeof avisoSchema]?: any };

/**
 * Convierte los argumentos de la tool al AvisoSalidaDto del backend. Con
 * `previo` (actualización) se conserva todo lo que no se mande.
 */
async function armarAviso(a: AvisoArgs, previo?: any) {
  let participantes: any[];
  const todos: any[] = await api('GET', '/caminantes');
  if (!a.participantesIds && previo?.participantes) {
    participantes = previo.participantes;
  } else if (!a.participantesIds) {
    // Por defecto: todos los jóvenes activos de la sección del aviso
    const delAviso = seccionDeRol((await usuarioActual()).rol) ?? a.seccion ?? previo?.seccion ?? null;
    // Aviso de todo el grupo: van los jóvenes de todas las secciones
    const seccion = delAviso === 'grupo' ? null : delAviso;
    participantes = todos
      .filter(c => c.activo !== false && (!seccion || c.seccion === seccion))
      .sort((x, y) => `${x.apellidos} ${x.nombre}`.localeCompare(`${y.apellidos} ${y.nombre}`, 'es'))
      .map(c => ({ nombre: c.nombre, apellidos: c.apellidos, cum: c.cum, fechaNacimiento: c.fechaNacimiento, seccion: c.seccion }));
  } else {
    const porId = new Map(todos.map(c => [c.id, c]));
    const faltan = a.participantesIds.filter((id: number) => !porId.has(id));
    if (faltan.length) throw new Error(`Caminantes no encontrados: ${faltan.join(', ')}`);
    participantes = a.participantesIds.map((id: number) => {
      const c = porId.get(id);
      return { nombre: c.nombre, apellidos: c.apellidos, cum: c.cum, fechaNacimiento: c.fechaNacimiento, seccion: c.seccion };
    });
  }
  // Mediodía para que la fecha no se corra de día por zona horaria al imprimir
  const mov = (m?: any) => m && { ...m, fecha: m.fecha ? `${m.fecha}T12:00:00` : undefined };
  const { participantesIds, ...resto } = a;
  const base = previo ?? { protocolo: await api('GET', '/avisos-salida/protocolo/defaults') };
  const nuevo = {
    ...resto,
    salida: a.salida ? mov(a.salida) : undefined,
    llegada: a.llegada ? mov(a.llegada) : undefined,
    participantes,
    scouters: a.scouters
      ? a.scouters.map((s: any) => ({ nombre: s.nombre, cum: s.cum ?? '' }))
      : previo?.scouters ?? SCOUTERS_DEFAULT.map(nombre => ({ nombre, cum: '' })),
    invitados: a.invitados?.map((s: any) => ({ nombre: s.nombre, cum: s.cum ?? '' })),
  };
  const dto = mezclar(base, JSON.parse(JSON.stringify(nuevo)));
  // provincia/grupo vienen con los defaults pero no son parte del aviso
  if (dto.protocolo) { delete dto.protocolo.provincia; delete dto.protocolo.grupo; }
  return dto;
}

async function faltantesProtocolo(id: number): Promise<string[]> {
  const r: any = await api('GET', `/avisos-salida/${id}/protocolo/faltantes`);
  return r.faltantes ?? [];
}

const AVISO_FALTANTES = 'Pregunta al usuario por estos datos del protocolo de traslado y guárdalos con actualizar_aviso antes de publicar.';

server.registerTool('listar_avisos', {
  title: 'Listar avisos de salida',
  description: 'Avisos de salida guardados (id, tipo, nombre, fecha de salida, quién lo creó).',
  inputSchema: {},
  annotations: LECTURA,
}, tool(async () => {
  const avisos: any[] = await api('GET', '/avisos-salida');
  return avisos.map(({ data, ...r }) => r);
}));

server.registerTool('ver_aviso', {
  title: 'Ver aviso de salida',
  description: 'Detalle completo de un aviso de salida.',
  inputSchema: { id: z.number().int() },
  annotations: LECTURA,
}, tool(({ id }: { id: number }) => api('GET', `/avisos-salida/${id}`)));

server.registerTool('crear_aviso', {
  title: 'Crear aviso de salida',
  description: 'Guarda un aviso de salida nuevo en la app. Por defecto van todos los caminantes activos de la sección y los scouters de siempre: no preguntes por ellos, omite participantesIds y scouters salvo que el usuario pida otra cosa. Todo aviso lleva protocolo de traslado (formato CNAR): coordinador, enlace y transporte vienen por defecto; la respuesta dice qué datos del protocolo faltan para que se los preguntes al usuario. Después usa publicar_aviso.',
  inputSchema: avisoSchema,
  annotations: ESCRITURA,
}, tool(async (a: AvisoArgs) => {
  const creado: any = await api('POST', '/avisos-salida', await armarAviso(a));
  const faltantes = await faltantesProtocolo(creado.id);
  return { id: creado.id, nombre: creado.nombre, fechaSalida: creado.fechaSalida, protocoloCompleto: !faltantes.length, faltantesProtocolo: faltantes, ...(faltantes.length ? { siguientePaso: AVISO_FALTANTES } : {}) };
}));

server.registerTool('actualizar_aviso', {
  title: 'Actualizar aviso de salida',
  description: 'Cambia solo los campos que mandes de un aviso existente (incluido el protocolo de traslado); lo demás se conserva. Devuelve qué falta del protocolo.',
  inputSchema: { id: z.number().int(), ...z.object(avisoSchema).partial().shape },
  annotations: ESCRITURA,
}, tool(async ({ id, ...a }: AvisoArgs & { id: number }) => {
  const previo: any = await api('GET', `/avisos-salida/${id}`);
  const act: any = await api('PUT', `/avisos-salida/${id}`, await armarAviso(a, previo.data));
  const faltantes = await faltantesProtocolo(id);
  return { id: act.id, nombre: act.nombre, fechaSalida: act.fechaSalida, protocoloCompleto: !faltantes.length, faltantesProtocolo: faltantes, ...(faltantes.length ? { siguientePaso: AVISO_FALTANTES } : {}) };
}));

server.registerTool('publicar_aviso', {
  title: 'Publicar aviso de salida',
  description: 'Genera el PDF del aviso, el permiso en blanco y el protocolo de traslado (Word oficial CNAR + PDF), los sube a Drive y devuelve los links y el enlace de WhatsApp para el grupo de papás. No publica si el protocolo está incompleto: en ese caso devuelve qué falta.',
  inputSchema: {
    id: z.number().int(),
    incluirPermisoEnBlanco: z.boolean().default(true).describe('También sube el permiso en blanco para que los papás lo impriman'),
    notaExtra: z.string().optional().describe('Texto adicional para el mensaje de WhatsApp (qué llevar, etc.)'),
  },
  annotations: PUBLICAR,
}, tool(async ({ id, incluirPermisoEnBlanco, notaExtra }: { id: number; incluirPermisoEnBlanco: boolean; notaExtra?: string }) => {
  const faltantes = await faltantesProtocolo(id);
  if (faltantes.length) {
    throw new Error(`No se publicó: el protocolo de traslado está incompleto. Falta: ${faltantes.join('; ')}. ${AVISO_FALTANTES}`);
  }
  const aviso: any = await api('GET', `/avisos-salida/${id}`);

  const protocolo = await guardarProtocolo(id, aviso);

  let permiso: Awaited<ReturnType<typeof guardarEnDrive>> | null = null;
  if (incluirPermisoEnBlanco) {
    const pdfPermiso = await apiBinary('GET', `/avisos-salida/${id}/permiso-en-blanco`);
    permiso = await guardarEnDrive(carpetas.salida(aviso, 'Permiso de padres'), 'Permiso de padres.pdf', pdfPermiso);
  }
  const pdf = await apiBinary('GET', `/avisos-salida/${id}/pdf`);
  const extra = [notaExtra, permiso?.link ? `✍️ Permiso para imprimir: ${permiso.link}` : ''].filter(Boolean).join('\n');
  const res = await publicar(carpetas.salida(aviso, 'Aviso de salida'), 'Aviso de salida.pdf', pdf, link => mensajeAviso(aviso, link, extra));
  return { ...res, permisoEnBlanco: permiso && { archivo: permiso.ruta, link: permiso.link }, protocoloTraslado: protocolo };
}));

/** Genera el protocolo (Word oficial + PDF) en la carpeta de la salida */
async function guardarProtocolo(id: number, aviso: any) {
  const carpeta = carpetas.salida(aviso, 'Protocolo de traslado');
  const docx = await apiBinary('GET', `/avisos-salida/${id}/protocolo`);
  const word = await guardarEnDrive(carpeta, 'Protocolo de traslado.docx', docx);
  const pdf = await docxAPdf(docx);
  const copiaPdf = pdf ? await guardarEnDrive(carpeta, 'Protocolo de traslado.pdf', pdf) : null;
  return {
    word: { archivo: word.ruta, link: word.link },
    pdf: copiaPdf ? { archivo: copiaPdf.ruta, link: copiaPdf.link } : null,
    nota: pdf ? 'Envíalo a la Comisión de Administración de Riesgos provincial y a cnar@scouts.org.mx.' : 'No se encontró LibreOffice para la copia en PDF; se guardó solo el Word.',
  };
}

server.registerTool('publicar_protocolo', {
  title: 'Publicar protocolo de traslado',
  description: 'Genera solo el protocolo de seguridad en el traslado (Word oficial CNAR + PDF) de un aviso y lo guarda en Drive, en Documentos <año>/<salida>/Protocolo de traslado. Falla si el protocolo está incompleto.',
  inputSchema: { id: z.number().int() },
  annotations: PUBLICAR,
}, tool(async ({ id }: { id: number }) => {
  const faltantes = await faltantesProtocolo(id);
  if (faltantes.length) throw new Error(`Protocolo incompleto. Falta: ${faltantes.join('; ')}. ${AVISO_FALTANTES}`);
  return guardarProtocolo(id, await api('GET', `/avisos-salida/${id}`));
}));

server.registerTool('descargar_permisos_zip', {
  title: 'Permisos individuales (ZIP)',
  description: 'Genera el ZIP con un permiso PDF por participante y lo guarda en Drive. Contiene datos personales: es para el staff, no para el grupo de papás.',
  inputSchema: { id: z.number().int() },
  annotations: ESCRITURA,
}, tool(async ({ id }: { id: number }) => {
  const aviso: any = await api('GET', `/avisos-salida/${id}`);
  const zip = await apiBinary('GET', `/avisos-salida/${id}/permisos`);
  return guardarEnDrive(carpetas.salida(aviso, 'Permiso de padres'), 'Permisos individuales.zip', zip);
}));

// ── Informes mensuales ──────────────────────────────────────────────────────────
server.registerTool('listar_informes', {
  title: 'Listar informes mensuales',
  description: 'Informes mensuales guardados (id, sección, año, mes).',
  inputSchema: { seccion: seccion.optional() },
  annotations: LECTURA,
}, tool(async ({ seccion }: { seccion?: string }) => {
  const todos: any[] = await api('GET', '/informes');
  return todos
    .filter(i => !seccion || i.seccion === seccion)
    .map(i => ({ id: i.id, seccion: i.seccion, anio: i.anio, mes: i.mes, nombreMes: MESES[i.mes] }));
}));

server.registerTool('ver_informe', {
  title: 'Ver informe mensual',
  description: 'Informe completo: membresía, altas/bajas, actividades, finanzas y progresión.',
  inputSchema: { id: z.number().int() },
  annotations: LECTURA,
}, tool(({ id }: { id: number }) => api('GET', `/informes/${id}`)));

server.registerTool('crear_informe', {
  title: 'Crear informe mensual',
  description: 'Crea el informe de un mes. Toma del último informe de la sección los totales de membresía y el saldo actual como saldo inicial, salvo que se indiquen. Agrega las actividades del mes del ciclo de programa si no se mandan. Luego usa actualizar_seccion_informe, importar_insignias_a_informe y publicar_informe.',
  inputSchema: {
    seccion,
    anio: z.number().int(),
    mes: z.number().int().min(1).max(12),
    saldoInicial: z.number().optional(),
    totalRegistrados: z.number().int().optional(),
    totalEnlace: z.number().int().optional(),
    totalCaptacion: z.number().int().optional(),
    totalNoRegistrados: z.number().int().optional(),
    observacionesGenerales: z.string().optional(),
  },
  annotations: ESCRITURA,
}, tool(async (a: any) => {
  const ultimo: any = await api('GET', `/informes/ultimo/${a.seccion}`);
  const existentes: any[] = await api('GET', '/informes');
  const dup = existentes.find(i => i.seccion === a.seccion && i.anio === a.anio && i.mes === a.mes);
  if (dup) throw new Error(`Ya existe el informe de ${MESES[a.mes]} ${a.anio} para ${a.seccion} (id ${dup.id}).`);

  let actividades: any[] = [];
  try {
    const acts: any[] = await api('GET', `/ciclos-programa/actividades-mes/${a.seccion}/${a.anio}/${a.mes}`);
    actividades = acts.map((x, i) => ({ fecha: x.fechaSabado, actividad: x.nombre || 'Actividad', asistencia: 0, orden: i }));
  } catch { /* sin ciclo para ese mes */ }

  const creado: any = await api('POST', '/informes', {
    seccion: a.seccion, anio: a.anio, mes: a.mes,
    saldoInicial: a.saldoInicial ?? Number(ultimo?.saldoActual ?? 0),
    totalRegistrados: a.totalRegistrados ?? ultimo?.totalRegistrados ?? 0,
    totalEnlace: a.totalEnlace ?? ultimo?.totalEnlace ?? 0,
    totalCaptacion: a.totalCaptacion ?? ultimo?.totalCaptacion ?? 0,
    totalNoRegistrados: a.totalNoRegistrados ?? ultimo?.totalNoRegistrados ?? 0,
    observacionesGenerales: a.observacionesGenerales,
    altasBajas: [], actividades, actividadesPendientes: [], movimientos: [], progresiones: [],
  });
  return {
    id: creado.id, seccion: creado.seccion, anio: creado.anio, mes: creado.mes,
    saldoInicial: creado.saldoInicial, actividadesPrecargadas: actividades.length,
    nota: 'Las asistencias de las actividades quedan en 0; actualízalas con actualizar_seccion_informe (actividades).',
  };
}));

server.registerTool('actualizar_seccion_informe', {
  title: 'Actualizar sección de un informe',
  description: `Reemplaza una sección de un informe (lo que no mandes de esa sección se borra; usa ver_informe antes). Formatos de "datos":
- config: { mes, anio, saldoInicial, observacionesGenerales? }
- membresia: { totalRegistrados, totalEnlace, totalCaptacion, totalNoRegistrados, altasBajas: [{ tipo: "alta"|"baja", nombre, cum? }] }
- actividades: { actividades: [{ fecha? YYYY-MM-DD, actividad, asistencia, observaciones? }], actividadesPendientes: [{ actividad, observaciones? }] }
- financiero: { saldoInicial, movimientos: [{ tipo: "ingreso"|"egreso", fecha?, concepto, cantidad }] }
- progresion: { progresiones: [{ descripcion, nombre, actividadNombre?, fecha? }], observacionesGenerales? }`,
  inputSchema: {
    id: z.number().int(),
    seccion: z.enum(['config', 'membresia', 'actividades', 'financiero', 'progresion']),
    datos: z.record(z.any()),
  },
  annotations: ESCRITURA,
}, tool(async ({ id, seccion, datos }: { id: number; seccion: string; datos: any }) => {
  // El backend reordena por índice; se añade `orden` por si el tipo lo exige
  for (const k of ['altasBajas', 'actividades', 'actividadesPendientes', 'movimientos', 'progresiones']) {
    if (Array.isArray(datos[k])) datos[k] = datos[k].map((x: any, i: number) => ({ ...x, orden: i }));
  }
  await api('PATCH', `/informes/${id}/${seccion}`, datos);
  return `Sección ${seccion} del informe ${id} actualizada.`;
}));

server.registerTool('importar_insignias_a_informe', {
  title: 'Importar solicitudes de insignias al informe',
  description: 'Agrega a la Progresión del informe las solicitudes de insignias de su sección y mes. No duplica filas ya existentes.',
  inputSchema: { id: z.number().int() },
  annotations: ESCRITURA,
}, tool(async ({ id }: { id: number }) => {
  const r: any = await api('POST', `/informes/${id}/importar-solicitudes-insignias`);
  return { agregadas: r.agregadas, progresiones: r.informe.progresiones };
}));

server.registerTool('publicar_informe', {
  title: 'Publicar informe mensual',
  description: 'Genera el PDF del informe mensual y lo sube a la carpeta de Drive del grupo. Devuelve el link (y un enlace de WhatsApp por si se quiere compartir).',
  inputSchema: { id: z.number().int() },
  annotations: PUBLICAR,
}, tool(async ({ id }: { id: number }) => {
  const inf: any = await api('GET', `/informes/${id}`);
  const pdf = await apiBinary('GET', `/informes/${id}/pdf`);
  return publicar(carpetas.informe(inf.seccion, inf.anio), `Informe-${MESES[inf.mes]}-${inf.anio}.pdf`, pdf,
    link => mensajeGenerico(`Informe mensual ${inf.seccion} – ${MESES[inf.mes]} ${inf.anio}`, '', link));
}));

server.registerTool('publicar_informe_anual', {
  title: 'Publicar informe anual',
  description: 'PDF con todos los informes mensuales de una sección en un año, subido a Drive.',
  inputSchema: { seccion, anio: z.number().int() },
  annotations: PUBLICAR,
}, tool(async ({ seccion, anio }: { seccion: string; anio: number }) => {
  const pdf = await apiBinary('GET', `/informes/anual/${seccion}/${anio}/pdf`);
  return publicar(carpetas.informe(seccion, anio), `Informe-Anual-${anio}.pdf`, pdf,
    link => mensajeGenerico(`Informe anual ${seccion} ${anio}`, '', link));
}));

// ── Solicitudes de insignias ────────────────────────────────────────────────────
server.registerTool('catalogo_insignias', {
  title: 'Catálogo de insignias',
  description: 'Ítems que se pueden solicitar (id, nombre, categoría). El kit de pañoleta lleva componentesKit y siempre debe incluir "motas".',
  inputSchema: {},
  annotations: LECTURA,
}, tool(() => api('GET', '/insignias/catalogo')));

server.registerTool('sugerencias_insignias', {
  title: 'Insignias ganadas por un caminante',
  description: 'Ítems del catálogo que el caminante ya tiene ganados según su progreso, para armar la solicitud.',
  inputSchema: { caminanteId: z.number().int() },
  annotations: LECTURA,
}, tool(({ caminanteId }: { caminanteId: number }) => api('GET', `/insignias/solicitudes/sugerencias/${caminanteId}`)));

server.registerTool('listar_solicitudes_insignias', {
  title: 'Listar solicitudes de insignias',
  description: 'Solicitudes de insignias registradas (filtradas por la sección del usuario).',
  inputSchema: {},
  annotations: LECTURA,
}, tool(() => api('GET', '/insignias/solicitudes')));

server.registerTool('crear_solicitud_insignias', {
  title: 'Crear solicitud de insignias',
  description: 'Registra una solicitud de insignias para un caminante. La sección se toma del caminante. Para que entre en un informe, la fecha debe caer en el mes del informe.',
  inputSchema: {
    caminanteId: z.number().int(),
    fecha: fecha.optional().describe('Por defecto hoy'),
    observaciones: z.string().optional(),
    lineas: z.array(z.object({
      catalogoItemId: z.number().int(),
      cantidad: z.number().int().min(1).optional(),
      componentesKit: z.array(z.string()).optional(),
      notas: z.string().optional(),
    })).min(1),
  },
  annotations: ESCRITURA,
}, tool(async (a: any) => {
  const s: any = await api('POST', '/insignias/solicitudes', a);
  return { id: s.id, fecha: s.fecha, seccion: s.seccion };
}));

server.registerTool('publicar_solicitud_insignias', {
  title: 'Publicar solicitud de insignias',
  description: 'Genera el PDF de una solicitud de insignias y lo sube a la carpeta de Drive del grupo.',
  inputSchema: { id: z.number().int() },
  annotations: PUBLICAR,
}, tool(async ({ id }: { id: number }) => {
  const s: any = await api('GET', `/insignias/solicitudes/${id}`);
  const pdf = await apiBinary('GET', `/insignias/solicitudes/${id}/pdf`);
  const fechaSol = String(s.fecha).slice(0, 10);
  const nombre = [s.caminante?.nombre, s.caminante?.apellidos].filter(Boolean).join(' ');
  const g = await guardarEnDrive(carpetas.solicitud(s.seccion, fechaSol.slice(0, 4)), `${fechaSol} ${nombre}.pdf`, pdf);
  return { archivo: g.ruta, enDrive: g.enDrive, linkDrive: g.link, nota: g.nota };
}));

// ── Ciclos de programa ──────────────────────────────────────────────────────────
const actividadCiclo = z.object({
  fechaSabado: fecha.describe('Sábado de la actividad'),
  nombre: z.string().optional(),
  ejeTematico: z.string().optional(),
  descripcion: z.string().optional(),
});
const cicloSchema = {
  nombre: z.string(),
  seccion,
  anio: z.number().int(),
  mesInicio: z.number().int().min(1).max(12),
  tipo: z.enum(['trimestral', 'cuatrimestral']),
  actividades: z.array(actividadCiclo),
};
const conOrden = (a: any[]) => a.map((x, i) => ({ ...x, orden: i }));

server.registerTool('listar_ciclos', {
  title: 'Listar ciclos de programa',
  description: 'Ciclos de programa registrados con sus actividades.',
  inputSchema: { seccion: seccion.optional(), anio: z.number().int().optional() },
  annotations: LECTURA,
}, tool(async ({ seccion, anio }: { seccion?: string; anio?: number }) => {
  const todos: any[] = await api('GET', '/ciclos-programa');
  return todos.filter(c => (!seccion || c.seccion === seccion) && (!anio || c.anio === anio));
}));

server.registerTool('crear_ciclo', {
  title: 'Crear ciclo de programa',
  description: 'Crea un ciclo de programa (trimestral o cuatrimestral) con una actividad por sábado. Queda visible en la app. Después usa publicar_ciclo.',
  inputSchema: cicloSchema,
  annotations: ESCRITURA,
}, tool(async (a: any) => {
  const c: any = await api('POST', '/ciclos-programa', { ...a, actividades: conOrden(a.actividades) });
  return { id: c.id, nombre: c.nombre, actividades: c.actividades?.length };
}));

server.registerTool('actualizar_ciclo', {
  title: 'Actualizar ciclo de programa',
  description: 'Reemplaza un ciclo existente (manda el ciclo completo con todas sus actividades; usa listar_ciclos antes).',
  inputSchema: { id: z.number().int(), ...cicloSchema },
  annotations: ESCRITURA,
}, tool(async ({ id, ...a }: any) => {
  const c: any = await api('PUT', `/ciclos-programa/${id}`, { ...a, actividades: conOrden(a.actividades) });
  return { id: c.id, nombre: c.nombre, actividades: c.actividades?.length };
}));

server.registerTool('publicar_ciclo', {
  title: 'Publicar ciclo de programa',
  description: 'Genera el PDF del ciclo, lo sube a la carpeta de Drive del grupo y devuelve el mensaje y el enlace de WhatsApp para el grupo de papás.',
  inputSchema: { id: z.number().int(), notaExtra: z.string().optional() },
  annotations: PUBLICAR,
}, tool(async ({ id, notaExtra }: { id: number; notaExtra?: string }) => {
  const c: any = await api('GET', `/ciclos-programa/${id}`);
  const pdf = await apiBinary('GET', `/ciclos-programa/${id}/pdf`);
  return publicar(carpetas.ciclo(c.seccion, c.anio), `${c.nombre}.pdf`, pdf,
    link => mensajeCiclo(c, link, notaExtra));
}));

server.registerTool('mensaje_whatsapp_papas', {
  title: 'Mensaje para el grupo de papás',
  description: 'Arma un enlace wa.me con un mensaje libre para pegar en el grupo de WhatsApp de papás (por ejemplo un recordatorio).',
  inputSchema: { titulo: z.string(), cuerpo: z.string(), link: z.string().optional() },
  annotations: LECTURA,
}, tool(async ({ titulo, cuerpo, link }: { titulo: string; cuerpo: string; link?: string }) => {
  const texto = mensajeGenerico(titulo, cuerpo, link ?? null);
  return { mensajeWhatsApp: texto, enlaceWhatsApp: enlaceWhatsApp(texto) };
}));


// ── Jóvenes, papás y secciones (cualquier scouter, siempre en su sección) ──────
const tutorSchema = z.object({
  nombre: z.string(),
  parentesco: z.string().optional().describe('Mamá, papá, abuela, tutor…'),
  telefono: z.string().optional(),
  email: z.string().optional(),
});

server.registerTool('registrar_joven', {
  title: 'Registrar joven',
  description: 'Da de alta a un joven (lobato/lobezna, scout, caminante o rover) y, opcionalmente, a sus papás (máximo 2). Un scouter registra solo en su sección; el administrador debe indicar la sección.',
  inputSchema: {
    nombre: z.string(),
    apellidos: z.string(),
    seccion: seccion.optional().describe('Obligatoria para el administrador'),
    cum: z.string().optional(),
    fechaNacimiento: fecha.optional(),
    email: z.string().optional(),
    equipo: z.string().optional().describe('Seisena, patrulla, equipo…'),
    fechaPromesa: fecha.optional(),
    fechaPaseInicio: fecha.optional(),
    tutores: z.array(tutorSchema).max(2).optional(),
  },
  annotations: ESCRITURA,
}, tool(async ({ tutores, ...datos }: any) => {
  const c: any = await api('POST', '/caminantes', datos);
  const t = tutores?.length ? await api('PUT', `/caminantes/${c.id}/tutores`, { tutores }) : [];
  return { id: c.id, nombre: `${c.nombre} ${c.apellidos}`, seccion: c.seccion, tutores: t };
}));

server.registerTool('actualizar_joven', {
  title: 'Actualizar joven',
  description: 'Cambia datos de un joven (solo los campos enviados). Cambiar de sección solo lo hace el administrador.',
  inputSchema: {
    id: z.number().int(),
    nombre: z.string().optional(), apellidos: z.string().optional(), seccion: seccion.optional(),
    cum: z.string().optional(), fechaNacimiento: fecha.optional(), email: z.string().optional(),
    equipo: z.string().optional(), fechaPromesa: fecha.optional(), fechaPaseInicio: fecha.optional(),
  },
  annotations: ESCRITURA,
}, tool(async ({ id, ...cambios }: any) => {
  const c: any = await api('PUT', `/caminantes/${id}`, cambios);
  return { id: c.id, nombre: `${c.nombre} ${c.apellidos}`, seccion: c.seccion };
}));

server.registerTool('guardar_tutores', {
  title: 'Guardar papás / tutores',
  description: 'Reemplaza los papás/tutores de un joven (máximo 2). Manda la lista completa; usa ver_caminante antes para conservar los existentes.',
  inputSchema: { id: z.number().int().describe('Id del joven'), tutores: z.array(tutorSchema).max(2) },
  annotations: ESCRITURA,
}, tool(({ id, tutores }: any) => api('PUT', `/caminantes/${id}/tutores`, { tutores })));

server.registerTool('ver_secciones', {
  title: 'Ver secciones',
  description: 'Nombres (vocabulario: lobatos y lobeznas, scouts, caminantes, rovers), colores, logo y si usan progresión, por sección.',
  inputSchema: {},
  annotations: LECTURA,
}, tool(() => api('GET', '/secciones')));

// ── Herramientas de administrador (solo si la cuenta conectada lo es) ─────────
const rolConectado = await usuarioActual().then(u => u.rol).catch(() => null);

if (rolConectado === 'administrador') {
  const ROLES_STAFF = ['administrador', 'jefe_grupo', 'sub_jefe_grupo', 'colaborador_grupo', 'contador_grupo', 'secretario_grupo',
    'jefe_manada', 'sub_jefe_manada', 'jefe_tropa', 'sub_jefe_tropa', 'jefe_comunidad', 'sub_jefe_comunidad', 'jefe_clan', 'sub_jefe_clan'] as const;

  server.registerTool('listar_usuarios', {
    title: 'Listar cuentas de scouters',
    description: 'Todas las cuentas de la app (sin contraseñas) con su rol y si están activas.',
    inputSchema: { incluirJovenes: z.boolean().default(false) },
    annotations: LECTURA,
  }, tool(async ({ incluirJovenes }: { incluirJovenes: boolean }) => {
    const us: any[] = await api('GET', '/usuarios');
    return us.filter(u => incluirJovenes || u.rol !== 'scout')
      .map(u => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo }));
  }));

  server.registerTool('crear_scouter', {
    title: 'Crear cuenta de scouter',
    description: 'Crea la cuenta de un scouter (p. ej. jefe_manada). Pide al usuario el correo y una contraseña inicial; recuérdale que la comparta de forma privada.',
    inputSchema: { nombre: z.string(), email: z.string(), password: z.string().min(6), rol: z.enum(ROLES_STAFF) },
    annotations: ESCRITURA,
  }, tool(async (d: any) => {
    const u: any = await api('POST', '/usuarios', d);
    return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
  }));

  server.registerTool('actualizar_scouter', {
    title: 'Actualizar cuenta de scouter',
    description: 'Cambia nombre, correo, rol, contraseña o activa/desactiva una cuenta de scouter.',
    inputSchema: {
      id: z.number().int(), nombre: z.string().optional(), email: z.string().optional(),
      password: z.string().min(6).optional(), rol: z.enum(ROLES_STAFF).optional(), activo: z.boolean().optional(),
    },
    annotations: ESCRITURA,
  }, tool(async ({ id, ...cambios }: any) => {
    const u: any = await api('PATCH', `/usuarios/${id}`, cambios);
    return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo };
  }));

  const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/).describe('Color #RRGGBB');
  server.registerTool('configurar_seccion', {
    title: 'Configurar sección',
    description: 'Cambia el vocabulario (nombres de la sección y de sus jóvenes, cargos), los colores o si usa progresión de una sección. Se refleja en el menú, las pantallas y los PDFs.',
    inputSchema: {
      clave: z.enum(['grupo', 'manada', 'tropa', 'comunidad', 'clan']),
      nombreCompleto: z.string().optional(), nombreCorto: z.string().optional(),
      jovenSingular: z.string().optional(), jovenPlural: z.string().optional(),
      cargoJefe: z.string().optional(), cargoSubjefe: z.string().optional(),
      colorPrincipal: hex.optional(), colorOscuro: hex.optional(), colorAcento: hex.optional(), colorTextoAcento: hex.optional(),
      progresionHabilitada: z.boolean().optional(),
    },
    annotations: ESCRITURA,
  }, tool(({ clave, ...cambios }: any) => api('PUT', `/secciones/${clave}`, cambios)));

  server.registerTool('subir_logo_seccion', {
    title: 'Subir logo de sección',
    description: 'Sube el logo de una sección desde un archivo de la computadora (PNG, JPG o WEBP, idealmente cuadrado). Aparece en el menú y en los documentos de esa sección.',
    inputSchema: {
      clave: z.enum(['grupo', 'manada', 'tropa', 'comunidad', 'clan']),
      archivo: z.string().describe('Ruta absoluta del archivo de imagen'),
    },
    annotations: ESCRITURA,
  }, tool(async ({ clave, archivo }: { clave: string; archivo: string }) => {
    const contenido = await fsp.readFile(archivo);
    const s: any = await apiUpload(`/secciones/${clave}/logo`, 'logo', pathMod.basename(archivo), contenido);
    return { clave: s.clave, logo: s.logo };
  }));
}

await server.connect(new StdioServerTransport());
