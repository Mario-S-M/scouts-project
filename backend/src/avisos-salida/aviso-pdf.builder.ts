/**
 * Diseño del aviso de salida y del permiso de salida (pdfmake).
 *
 * pdfmake no redondea fondos de tablas, así que las tarjetas se dibujan con un
 * rectángulo redondeado en canvas y el contenido encima con relativePosition.
 * Por eso cada tarjeta necesita una altura conocida: `alturaTexto` la estima.
 */
import { AvisoSalidaDto, ParticipanteDto } from './dto/aviso-salida.dto';
import { fechaCorta, fechaLarga, hora } from './aviso-formato';

// ── Identidad de la Comunidad ────────────────────────────────────────────────
export const K = {
  navy: '#14265C',
  navy2: '#22387A',
  navyLight: '#E8ECF6',
  gold: '#EFC02F',
  goldLight: '#FDF5D6',
  page: '#F4F6FB',
  card: '#FFFFFF',
  border: '#D9DEEA',
  text: '#1B2333',
  muted: '#6B7385',
  input: '#F7F8FB',
};

const SECCIONES: Record<string, { label: string; bg: string; fg: string }> = {
  manada: { label: 'Lobatos', bg: '#FBBF24', fg: '#3A2A00' },
  tropa: { label: 'Scouts', bg: '#16A34A', fg: '#FFFFFF' },
  comunidad: { label: 'Caminantes', bg: '#2563EB', fg: '#FFFFFF' },
  clan: { label: 'Rovers', bg: '#DC2626', fg: '#FFFFFF' },
};

export interface ContextoPdf {
  logoGrupo: string | null;
  logoCC: string | null;
  mapImage?: string | null;
}

// ── Primitivas ───────────────────────────────────────────────────────────────

/** Altura aproximada de un texto en Roboto dentro de un ancho dado */
function alturaTexto(texto: string, ancho: number, fontSize = 9, lineHeight = 1.25): number {
  const porLinea = Math.max(1, Math.floor(ancho / (fontSize * 0.5)));
  const lineas = (texto || ' ').split('\n')
    .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / porLinea)), 0);
  return lineas * fontSize * lineHeight + 1;
}

/**
 * Tarjeta redondeada de alto fijo. El fondo y el contenido se dibujan como
 * bloques "despegados" desde la esquina superior (relativePosition) y un
 * espaciador invisible ocupa el alto en el flujo; así pdfmake decide el salto
 * de página con la tarjeta completa y nunca separa el contenido de su fondo.
 */
function tarjeta(ancho: number, alto: number, contenido: any[], opts: { fill?: string; borde?: string | null; pad?: number; r?: number } = {}): any {
  const pad = opts.pad ?? 12;
  const fill = opts.fill ?? K.card;
  return {
    width: ancho,
    unbreakable: true,
    stack: [
      {
        relativePosition: { x: 0, y: 0 },
        canvas: [{
          type: 'rect', x: 0, y: 0, w: ancho, h: alto, r: opts.r ?? 10,
          color: fill, lineColor: opts.borde === null ? fill : (opts.borde ?? K.border), lineWidth: 0.8,
        }],
      },
      { relativePosition: { x: pad, y: pad }, stack: contenido, width: ancho - pad * 2 },
      { canvas: [{ type: 'line', x1: 0, y1: alto, x2: 0.01, y2: alto, lineWidth: 0, lineColor: fill }] },
    ],
  };
}

/** Píldora redondeada con texto (chips de tipo, sección, costo). Ocupa solo su ancho. */
function chip(texto: string, fill: string, color: string, fontSize = 8, padX = 8): any {
  const w = texto.length * fontSize * 0.58 + padX * 2;
  const h = fontSize + 8;
  return {
    columns: [{
      width: w,
      stack: [
        { relativePosition: { x: 0, y: 0 }, canvas: [{ type: 'rect', x: 0, y: 0, w, h, r: h / 2, color: fill }] },
        { relativePosition: { x: 0, y: 3.5 }, text: texto, fontSize, bold: true, color, width: w, alignment: 'center' },
        { canvas: [{ type: 'line', x1: 0, y1: h, x2: 0.01, y2: h, lineWidth: 0, lineColor: fill }] },
      ],
    }],
    width: w,
  };
}

function etiqueta(texto: string, color = K.muted): any {
  return { text: texto.toUpperCase(), fontSize: 7, bold: true, color, characterSpacing: 1.1, margin: [0, 0, 0, 3] };
}

/** Encabezado institucional: banda azul marino redondeada con ambos logos */
function encabezado(ctx: ContextoPdf, ancho: number, subtitulo: string): any {
  const alto = 64;
  return {
    margin: [0, 0, 0, 14],
    stack: [
      { relativePosition: { x: 0, y: 0 }, canvas: [
        { type: 'rect', x: 0, y: 0, w: ancho, h: alto, r: 14, color: K.navy },
        { type: 'rect', x: 0, y: alto - 14, w: ancho, h: 9, color: K.navy },
        { type: 'rect', x: 0, y: alto - 5, w: ancho, h: 5, r: 2, color: K.gold },
      ] },
      {
        relativePosition: { x: 0, y: 0 },
        columns: [
          ctx.logoGrupo
            ? { image: 'logoGrupo', width: 46, height: 46, margin: [12, 6, 0, 0] }
            : { text: '⚜', fontSize: 30, color: K.gold, width: 58, margin: [16, 10, 0, 0] },
          {
            width: '*',
            margin: [10, 13, 0, 0],
            stack: [
              { text: 'ASOCIACIÓN DE SCOUTS DE MÉXICO, A.C.', fontSize: 11.5, bold: true, color: '#FFFFFF', characterSpacing: 0.6 },
              { text: subtitulo, fontSize: 8.5, color: K.gold, margin: [0, 3, 0, 0], characterSpacing: 0.4 },
            ],
          },
          ctx.logoCC
            ? {
              width: 128,
              margin: [0, 9, 12, 0],
              stack: [
                { relativePosition: { x: 0, y: 0 }, canvas: [{ type: 'rect', x: 0, y: 0, w: 116, h: 38, r: 8, color: '#FFFFFF' }] },
                { image: 'logoCC', width: 108, relativePosition: { x: 4, y: 2 } },
              ],
            }
            : { text: '', width: 10 },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: alto, x2: 0.01, y2: alto, lineWidth: 0, lineColor: K.navy }] },
    ],
  };
}

function nombreCompleto(p: { nombre?: string; apellidos?: string }): string {
  return `${p.nombre ?? ''} ${p.apellidos ?? ''}`.trim();
}

// ── Aviso de salida ──────────────────────────────────────────────────────────

const A4_ANCHO = 595.28;
const M = 30;

export function documentoAviso(dto: AvisoSalidaDto, ctx: ContextoPdf): any {
  const W = A4_ANCHO - M * 2;
  const gap = 10;
  const scouters = (dto.scouters ?? []).filter((s) => s.nombre?.trim());
  const invitados = (dto.invitados ?? []).filter((s) => s.nombre?.trim());
  const participantes = dto.participantes ?? [];
  const total = participantes.length + scouters.length + invitados.length;

  // ─ Título de la actividad ─
  const costo = Number(dto.costo ?? 0);
  const titulo = {
    margin: [2, 0, 0, 12],
    columns: [
      {
        width: '*',
        stack: [
          { columns: [chip('AVISO DE SALIDA', K.navy, '#FFFFFF', 7.5), { width: 6, text: '' }, chip((dto.tipo || 'Actividad').toUpperCase(), K.goldLight, K.navy, 7.5)], columnGap: 0 },
          { text: dto.nombre || 'Actividad', fontSize: 20, bold: true, color: K.navy, margin: [0, 8, 0, 2] },
          { text: fechaLarga(dto.salida?.fecha) + (dto.llegada?.fecha && fechaCorta(dto.llegada.fecha) !== fechaCorta(dto.salida?.fecha) ? `  →  ${fechaLarga(dto.llegada.fecha)}` : ''), fontSize: 9.5, color: K.muted },
        ],
      },
      costo > 0
        ? {
          width: 92,
          stack: [tarjeta(92, 56, [
            { text: 'COSTO', fontSize: 7, bold: true, color: K.navy, characterSpacing: 1.1, alignment: 'center' },
            { text: `$${costo.toLocaleString('es-MX')}`, fontSize: 20, bold: true, color: K.navy, alignment: 'center', margin: [0, 2, 0, 0] },
          ], { fill: K.gold, borde: null, pad: 8, r: 12 })],
        }
        : { width: 0, text: '' },
    ],
  };

  // ─ Salida / Regreso ─
  const mitad = (W - gap) / 2;
  const movimiento = (tituloMov: string, m: any, acento: string) => [
    { columns: [{ width: 4, canvas: [{ type: 'rect', x: 0, y: 0, w: 4, h: 54, r: 2, color: acento }] }, {
      width: '*', margin: [10, 0, 0, 0], stack: [
        etiqueta(tituloMov),
        { text: hora(m?.hora) || '—', fontSize: 18, bold: true, color: K.navy },
        { text: fechaLarga(m?.fecha) || '—', fontSize: 9, color: K.text, margin: [0, 2, 0, 0] },
        { text: m?.lugar || '—', fontSize: 9, color: K.muted, margin: [0, 2, 0, 0] },
      ],
    }] },
  ];
  const filaMov = {
    columns: [
      tarjeta(mitad, 78, movimiento('Salida', dto.salida, K.navy)),
      tarjeta(mitad, 78, movimiento('Regreso', dto.llegada, K.gold)),
    ],
    columnGap: gap,
    margin: [0, 0, 0, gap],
  };

  // ─ Transporte / Asistentes / Contacto ─
  const tercio = (W - gap * 2) / 3;
  const porSeccion = Object.entries(SECCIONES)
    .map(([k, s]) => ({ ...s, n: participantes.filter((p) => p.seccion === k).length }))
    .filter((s) => s.n > 0);
  const lineasAsist = porSeccion.length + (scouters.length ? 1 : 0) + (invitados.length ? 1 : 0);
  const contactoAct = dto.contactoActividad;
  const textoTransporte = dto.transporte || '—';
  const altoFila2 = Math.max(92, 40 + Math.max(lineasAsist * 15, alturaTexto(textoTransporte, tercio - 24, 10)));
  const filaInfo = {
    columns: [
      tarjeta(tercio, altoFila2, [
        etiqueta('Transporte'),
        { text: textoTransporte, fontSize: 10, bold: true, color: K.navy },
      ]),
      tarjeta(tercio, altoFila2, [
        etiqueta('Asistentes'),
        { columns: [
          { text: String(total), fontSize: 26, bold: true, color: K.navy, width: 'auto' },
          { width: '*', margin: [8, 2, 0, 0], stack: [
            ...porSeccion.map((s) => ({ columns: [chip(String(s.n), s.bg, s.fg, 7, 4), { text: s.label, fontSize: 8.5, color: K.text, margin: [5, 2, 0, 0] }], margin: [0, 0, 0, 3] })),
            ...(scouters.length ? [{ columns: [chip(String(scouters.length), K.navy, '#FFFFFF', 7, 4), { text: 'Scouters', fontSize: 8.5, color: K.text, margin: [5, 2, 0, 0] }], margin: [0, 0, 0, 3] }] : []),
            ...(invitados.length ? [{ columns: [chip(String(invitados.length), K.muted, '#FFFFFF', 7, 4), { text: 'Invitados', fontSize: 8.5, color: K.text, margin: [5, 2, 0, 0] }] }] : []),
          ] },
        ] },
      ]),
      tarjeta(tercio, altoFila2, [
        etiqueta('Responsable en la actividad'),
        { text: contactoAct?.nombre || '—', fontSize: 10, bold: true, color: K.navy },
        contactoAct?.cargo ? { text: contactoAct.cargo, fontSize: 8.5, color: K.muted, margin: [0, 2, 0, 0] } : null,
        contactoAct?.telefono ? { text: `Tel. ${contactoAct.telefono}`, fontSize: 9, color: K.text, margin: [0, 4, 0, 0] } : null,
      ].filter(Boolean)),
    ],
    columnGap: gap,
    margin: [0, 0, 0, gap],
  };

  // ─ Lugar y contacto local ─
  const cl = dto.contactoLocal;
  const anchoLugar = W - tercio - gap;
  const textoLugar = dto.lugarDescripcion || '—';
  const altoFila3 = Math.max(74, 34 + alturaTexto(textoLugar, anchoLugar - 24, 10));
  const filaLugar = {
    columns: [
      tarjeta(anchoLugar, altoFila3, [
        etiqueta('Lugar'),
        { text: textoLugar, fontSize: 10, color: K.text, lineHeight: 1.25 },
      ]),
      tarjeta(tercio, altoFila3, [
        etiqueta('Contacto en Morelia'),
        { text: cl?.nombre || '—', fontSize: 10, bold: true, color: K.navy },
        cl?.cargo ? { text: cl.cargo, fontSize: 8.5, color: K.muted, margin: [0, 2, 0, 0] } : null,
        cl?.telefono ? { text: `Tel. ${cl.telefono}`, fontSize: 9, color: K.text, margin: [0, 4, 0, 0] } : null,
      ].filter(Boolean)),
    ],
    columnGap: gap,
    margin: [0, 0, 0, gap],
  };

  // ─ Mapa ─
  const altoMapa = 230;
  const mapa = ctx.mapImage
    ? tarjeta(W, altoMapa + 34, [
      etiqueta('Ubicación'),
      { image: 'mapImg', width: W - 24, height: altoMapa - 6 },
    ])
    : null;

  // ─ Lista de asistentes (hoja 2) ─
  const lista = listaAsistentes(dto, W, scouters, invitados);

  const images: Record<string, string> = {};
  if (ctx.mapImage) images.mapImg = ctx.mapImage;
  if (ctx.logoGrupo) images.logoGrupo = ctx.logoGrupo;
  if (ctx.logoCC) images.logoCC = ctx.logoCC;

  return {
    pageSize: 'A4',
    pageMargins: [M, M, M, 36],
    background: (_p: number, size: any) => ({ canvas: [{ type: 'rect', x: 0, y: 0, w: size.width, h: size.height, color: K.page }] }),
    footer: (pagina: number, totalPaginas: number) => ({
      columns: [
        { text: 'Comunidad de Caminantes · Grupo 7 Morelia', fontSize: 7, color: K.muted },
        { text: `${pagina} / ${totalPaginas}`, fontSize: 7, color: K.muted, alignment: 'right' },
      ],
      margin: [M, 12, M, 0],
    }),
    defaultStyle: { font: 'Roboto', fontSize: 9, color: K.text },
    images,
    content: [
      encabezado(ctx, W, 'PROVINCIA MICHOACÁN  ·  GRUPO 7 MORELIA  ·  COMUNIDAD DE CAMINANTES'),
      titulo,
      filaMov,
      filaInfo,
      filaLugar,
      mapa,
      { ...encabezado(ctx, W, 'LISTA DE ASISTENTES'), pageBreak: 'before' },
      ...lista,
    ].filter(Boolean),
  };
}

function listaAsistentes(dto: AvisoSalidaDto, W: number, scouters: any[], invitados: any[]): any[] {
  const participantes = dto.participantes ?? [];
  const bloques: any[] = [
    { columns: [
      { text: dto.nombre || 'Actividad', fontSize: 16, bold: true, color: K.navy, width: '*' },
      chip(`${participantes.length + scouters.length + invitados.length} asistentes`, K.gold, K.navy, 8.5, 10),
    ], margin: [2, 0, 0, 12] },
  ];

  const tabla = (titulo: string, color: string, colorTexto: string, filas: any[][], encabezados: string[], anchos: any[]) => ({
    margin: [0, 0, 0, 12],
    unbreakable: filas.length <= 20,
    stack: [
      { columns: [chip(titulo.toUpperCase(), color, colorTexto, 7.5, 10), { text: `${filas.length}`, fontSize: 8, color: K.muted, margin: [6, 3, 0, 0] }], margin: [0, 0, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: anchos,
          body: [
            encabezados.map((h, i) => ({ text: h, fontSize: 7.5, bold: true, color: K.muted, alignment: i === 0 ? 'center' : 'left', margin: [0, 4, 0, 4] })),
            ...filas.map((f, r) => f.map((c, i) => ({ text: c, fontSize: 8.5, alignment: i === 0 ? 'center' : 'left', color: i === 0 ? K.muted : K.text, fillColor: r % 2 ? K.card : '#FAFBFD', margin: [0, 3.5, 0, 3.5] }))),
          ],
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 1 ? 1 : i === 0 || i === node.table.body.length ? 0 : 0.4),
          vLineWidth: () => 0,
          hLineColor: (i: number) => (i === 1 ? color : K.border),
          paddingLeft: () => 8,
          paddingRight: () => 8,
        },
      },
    ],
  });

  if (scouters.length) {
    bloques.push(tabla('Scouters', K.navy, '#FFFFFF', scouters.map((s, i) => [String(i + 1), s.nombre, s.cum || '—']), ['#', 'NOMBRE', 'CUM'], [22, '*', 110]));
  }
  for (const [k, s] of Object.entries(SECCIONES)) {
    const ps: ParticipanteDto[] = participantes.filter((p) => p.seccion === k);
    if (!ps.length) continue;
    bloques.push(tabla(s.label, s.bg, s.fg,
      ps.map((p, i) => [String(i + 1), nombreCompleto(p), p.cum || '—', fechaCorta(p.fechaNacimiento) || '—']),
      ['#', 'NOMBRE', 'CUM', 'NACIMIENTO'], [22, '*', 92, 70]));
  }
  if (invitados.length) {
    bloques.push(tabla('Invitados', K.muted, '#FFFFFF', invitados.map((s, i) => [String(i + 1), s.nombre, s.cum || '—']), ['#', 'NOMBRE', 'CUM'], [22, '*', 110]));
  }

  // Firmas
  const firma = (t: string) => ({ width: '*', stack: [
    { canvas: [{ type: 'line', x1: 20, y1: 0, x2: (W - 40) / 2 - 20, y2: 0, lineWidth: 0.8, lineColor: K.navy }] },
    { text: t, fontSize: 8.5, color: K.muted, alignment: 'center', margin: [0, 5, 0, 0] },
  ] });
  bloques.push({ columns: [firma('Jefe(a) de Grupo'), firma('Responsable en la actividad')], columnGap: 40, margin: [0, 36, 0, 0], unbreakable: true });
  return bloques;
}

// ── Permiso de salida (carta, una hoja por joven) ────────────────────────────

const CARTA_ANCHO = 612;
const MP = 32;

export function documentoPermisos(dto: AvisoSalidaDto, targets: (ParticipanteDto | null)[], ctx: ContextoPdf): any {
  const images: Record<string, string> = {};
  if (ctx.logoGrupo) images.logoGrupo = ctx.logoGrupo;
  if (ctx.logoCC) images.logoCC = ctx.logoCC;
  const content: any[] = [];
  targets.forEach((p, i) => {
    const pagina = paginaPermiso(dto, p, ctx);
    if (i > 0) pagina[0] = { ...pagina[0], pageBreak: 'before' };
    content.push(...pagina);
  });
  return {
    pageSize: 'LETTER',
    pageMargins: [MP, 28, MP, 24],
    background: (_p: number, size: any) => ({ canvas: [{ type: 'rect', x: 0, y: 0, w: size.width, h: size.height, color: K.page }] }),
    defaultStyle: { font: 'Roboto', fontSize: 9, color: K.text },
    images,
    content,
  };
}

function paginaPermiso(dto: AvisoSalidaDto, p: ParticipanteDto | null, ctx: ContextoPdf): any[] {
  const W = CARTA_ANCHO - MP * 2;
  const gap = 10;
  const mitad = (W - gap) / 2;
  const costo = Number(dto.costo ?? 0);

  /** Campo para llenar: etiqueta arriba y caja redondeada (con valor si ya se conoce) */
  const campo = (lbl: string, ancho: number, valor = '') => ({
    width: ancho,
    stack: [
      { text: lbl, fontSize: 7.5, bold: true, color: K.muted, margin: [2, 0, 0, 2] },
      tarjeta(ancho, 20, [{ text: valor || ' ', fontSize: 9, bold: true, color: K.navy }], { fill: valor ? K.navyLight : K.card, pad: 5, r: 6 }),
    ],
  });
  const fila = (...cols: any[]) => ({ columns: cols, columnGap: gap, margin: [0, 0, 0, 8] });
  const siNo = (pregunta: string) => ({
    columns: [
      { text: pregunta, fontSize: 8.5, color: K.text, width: '*', margin: [0, 3, 0, 0] },
      ...['Sí', 'No'].map((t) => ({ width: 44, columns: [
        { width: 14, canvas: [{ type: 'rect', x: 0, y: 1, w: 12, h: 12, r: 3, color: K.card, lineColor: K.navy, lineWidth: 0.8 }] },
        { text: t, fontSize: 8.5, bold: true, color: K.navy, margin: [4, 2, 0, 0] },
      ] })),
    ],
    margin: [0, 0, 0, 8],
  });
  const movimiento = (t: string, m: any, acento: string) => tarjeta(mitad, 58, [{ columns: [
    { width: 4, canvas: [{ type: 'rect', x: 0, y: 0, w: 4, h: 36, r: 2, color: acento }] },
    { width: '*', margin: [9, 0, 0, 0], stack: [
      etiqueta(t),
      { text: [{ text: hora(m?.hora) || '—', bold: true, color: K.navy, fontSize: 12 }, { text: `   ${fechaLarga(m?.fecha)}`, color: K.text, fontSize: 8.5 }] },
      { text: m?.lugar || '—', fontSize: 8.5, color: K.muted, margin: [0, 2, 0, 0] },
    ] },
  ] }], { pad: 10 });

  const contactos = [...(dto.scouters ?? [])].filter((s) => s.nombre?.trim());
  const ca = dto.contactoActividad;

  return [
    encabezado(ctx, W, 'PROVINCIA MICHOACÁN  ·  GRUPO 7 MORELIA  ·  COMUNIDAD DE CAMINANTES'),
    {
      margin: [2, -2, 0, 10],
      columns: [
        { width: '*', stack: [
          chip('PERMISO DE SALIDA', K.navy, '#FFFFFF', 7.5),
          { text: dto.nombre || 'Actividad', fontSize: 17, bold: true, color: K.navy, margin: [0, 6, 0, 0] },
          dto.lugarDescripcion ? { text: dto.lugarDescripcion, fontSize: 8.5, color: K.muted, margin: [0, 2, 0, 0] } : null,
        ].filter(Boolean) },
        costo > 0
          ? { width: 80, stack: [tarjeta(80, 46, [
            { text: 'COSTO', fontSize: 6.5, bold: true, color: K.navy, characterSpacing: 1, alignment: 'center' },
            { text: `$${costo.toLocaleString('es-MX')}`, fontSize: 16, bold: true, color: K.navy, alignment: 'center' },
          ], { fill: K.gold, borde: null, pad: 7, r: 10 })] }
          : { width: 0, text: '' },
      ],
    },
    { columns: [movimiento('Salida', dto.salida, K.navy), movimiento('Regreso', dto.llegada, K.gold)], columnGap: gap, margin: [0, 0, 0, 12] },

    { text: [{ text: 'AUTORIZO ', bold: true, color: K.navy }, { text: 'a mi hijo(a) a asistir a esta actividad y proporciono los siguientes datos para cualquier emergencia:' }], fontSize: 9, margin: [2, 0, 0, 8] },
    fila(campo('Nombre del joven', W * 0.68, p ? nombreCompleto(p) : ''), campo('CUM', W * 0.32 - gap, p?.cum ?? '')),
    fila(campo('Tipo de sangre', 90), campo('Teléfono de emergencia', (W - 90 - gap) / 2), campo('Nombre del contacto de emergencia', (W - 90 - gap) / 2 - gap)),
    siNo('¿Tiene alergias?'),
    fila(campo('Especifique alergias', W)),
    fila(campo('Problemas graves de salud que le impidan realizar alguna actividad', W)),
    fila(campo('Medicamentos que toma actualmente', W)),
    siNo('En caso de emergencia, ¿autorizo que mi hijo(a) sea llevado al hospital o clínica que los scouters consideren más conveniente?'),
    fila(campo('Hospital, clínica o centro de salud de preferencia', W)),
    fila(campo('No. IMSS', (W - gap * 2) / 3), campo('No. ISSSTE', (W - gap * 2) / 3), campo('No. de póliza de seguro', (W - gap * 2) / 3)),

    tarjeta(W, 26 + Math.max(1, contactos.length + (ca?.telefono ? 1 : 0)) * 13, [
      etiqueta('Contacto de los scouters'),
      ...(contactos.length
        ? contactos.map((s) => ({ text: [{ text: s.nombre, bold: true, color: K.navy }, s.cum ? { text: `  ·  CUM ${s.cum}`, color: K.muted } : ''], fontSize: 8.5, margin: [0, 0, 0, 2] }))
        : [{ text: '—', color: K.muted }]),
      ca?.telefono ? { text: `Responsable: ${ca.nombre ?? ''}  ·  Tel. ${ca.telefono}`, fontSize: 8.5, color: K.text } : null,
    ].filter(Boolean), { pad: 10 }),

    { columns: [
      { width: '*', stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: mitad - 10, y2: 0, lineWidth: 0.8, lineColor: K.navy }] },
        { text: 'Nombre y firma del padre, madre o tutor', fontSize: 8, color: K.muted, alignment: 'center', margin: [0, 4, 0, 0] },
      ] },
      { width: '*', stack: [
        { canvas: [{ type: 'line', x1: 10, y1: 0, x2: mitad, y2: 0, lineWidth: 0.8, lineColor: K.navy }] },
        { text: 'Fecha', fontSize: 8, color: K.muted, alignment: 'center', margin: [0, 4, 0, 0] },
      ] },
    ], columnGap: gap, margin: [0, 30, 0, 0] },
  ];
}
