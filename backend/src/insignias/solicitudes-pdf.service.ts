import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SolicitudInsignias } from './entities/solicitud-insignias.entity';
import {
  SolicitudInsigniasLinea,
  ComponenteKit,
  COMPONENTES_KIT,
} from './entities/solicitud-insignias-linea.entity';
import { SeccionesService } from '../secciones/secciones.service';
import { IdentidadPdf } from '../secciones/identidad-pdf';
import {
  CategoriaCatalogo,
  CATEGORIAS_CATALOGO,
} from './entities/catalogo-insignia.entity';

const PdfPrinter = require('pdfmake/js/Printer').default;
const vfsFonts   = require('pdfmake/build/vfs_fonts');

// ── Paleta institucional (tomada del emblema de la Comunidad: azul + oro) ────
let AZUL     = '#14265C';  // azul marino del bordado del Grupo 7
let AZUL_MED = '#2C4A9A';  // azul del emblema (rosa de los vientos)
let AZUL_CLR = '#EDF1FA';  // fondo de fila alterna / encabezado de categoría
let ORO      = '#EFC02F';  // amarillo del sol del emblema
let ORO_OSC  = '#B8891A';  // oro oscuro para texto sobre claro
const WH       = '#FFFFFF';
const BK       = '#1A1A1A';
const TX_SUAVE = '#5A6478';  // texto secundario
const LINEA    = '#C7D0E4';  // líneas de tabla suaves

/** Zona horaria de Morelia: el contenedor corre en UTC */
const TZ = 'America/Mexico_City';

/** Etiquetas legibles de las categorías del catálogo */
const ETIQUETA_CATEGORIA: Record<CategoriaCatalogo, string> = {
  progresion:      'Progresión',
  eje_tematico:    'Ejes temáticos',
  sendero:         'Senderos',
  cinta_comunidad: 'Cintas de comunidad',
  cordon_mando:    'Cordón de mando',
  kit_panoleta:    'Kit de pañoleta',
};

/** Etiquetas legibles de los componentes del kit de pañoleta */
const ETIQUETA_COMPONENTE: Record<ComponenteKit, string> = {
  motas:        'Motas',
  escudo_grupo: 'Escudo de grupo',
  numero_grupo: 'Número de grupo',
  sector:       'Sector',
  panoleta:     'Pañoleta',
  flor_de_lis:  'Flor de lis',
};

/**
 * La paleta toma los colores de la sección de la solicitud; se fija al inicio
 * de cada documento (la construcción es síncrona tras la última espera).
 */
function aplicarPaleta(id: IdentidadPdf) {
  AZUL = id.principal; AZUL_MED = id.principalMedio; AZUL_CLR = id.principalClaro;
  ORO = id.acento; ORO_OSC = id.acentoOscuro;
}

/** Etiquetas legibles de las secciones del Grupo */
const ETIQUETA_SECCION: Record<string, string> = {
  manada:    'Manada de Lobatos',
  tropa:     'Tropa de Scouts',
  comunidad: 'Comunidad de Caminantes',
  clan:      'Clan de Rovers',
  grupo:     'Grupo Scout',
};

/** Grupo de líneas listo para pintar: una categoría con sus ítems */
interface GrupoCategoria {
  titulo: string;
  lineas: SolicitudInsigniasLinea[];
}

/**
 * Genera el PDF de una solicitud de insignias, con los logos del Grupo y de la
 * Comunidad, siguiendo el patrón de InformesService.
 *
 * Tolera solicitudes incompletas: el documento se arma igual para una solicitud
 * guardada (con id y relaciones cargadas) que para una temporal montada desde
 * el DTO para la previsualización.
 */
@Injectable()
export class SolicitudesPdfService {
  private printer:   any;
  private logoGrupo: string | null = null;

  constructor(private readonly secciones: SeccionesService) {
    const fontBuffers: Record<string, Buffer> = {
      'Roboto-Regular.ttf':      Buffer.from(vfsFonts['Roboto-Regular.ttf'],      'base64'),
      'Roboto-Medium.ttf':       Buffer.from(vfsFonts['Roboto-Medium.ttf'],       'base64'),
      'Roboto-Italic.ttf':       Buffer.from(vfsFonts['Roboto-Italic.ttf'],       'base64'),
      'Roboto-MediumItalic.ttf': Buffer.from(vfsFonts['Roboto-MediumItalic.ttf'], 'base64'),
    };
    this.printer = new PdfPrinter(
      { Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf',
                  italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' } },
      { existsSync: (k) => k in fontBuffers, readFileSync: (k) => fontBuffers[k] },
      { resolve: () => {}, resolved: () => Promise.resolve() },
    );
    const assetsDir = path.join(__dirname, '../../public/assets');
    // Se prefieren las versiones reducidas (_pdf) para no inflar el peso del PDF
    const pick = (...names: string[]) =>
      names.map(n => path.join(assetsDir, n)).find(f => fs.existsSync(f)) ?? null;
    const grupoPath = pick('logo_Grupo_pdf.png', 'logo_Grupo.png');
    if (grupoPath) this.logoGrupo = `data:image/png;base64,${fs.readFileSync(grupoPath).toString('base64')}`;
    if (!grupoPath) {
      // eslint-disable-next-line no-console
      console.warn(`[SolicitudesPdfService] Logos no encontrados en ${assetsDir}; el PDF usará el escudo de respaldo.`);
    }
  }

  // ── Normalizadores: nada de lo que llega se da por seguro ───────────────────

  /** Nombre completo de un usuario; '—' si no vino la relación */
  private nombreCompleto(user: any, respaldo = '—'): string {
    if (!user) return respaldo;
    const partes = [user.nombre, user.apellidos].filter(Boolean);
    return partes.length ? partes.join(' ').trim() : respaldo;
  }

  /**
   * La fecha puede llegar como Date (entidad hidratada), como 'YYYY-MM-DD'
   * (columna date de PostgreSQL o DTO de la previsualización) o faltar.
   */
  private parseFecha(valor: any): Date {
    if (valor instanceof Date && !isNaN(valor.getTime())) return valor;
    if (typeof valor === 'string' && valor.trim()) {
      // El mediodía evita que el desfase de zona horaria corra el día
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())
        ? `${valor.trim()}T12:00:00`
        : valor.trim();
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  /** Fecha larga en español, con la zona horaria de Morelia */
  private fmtFecha(valor: any): string {
    return this.parseFecha(valor).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ,
    });
  }

  /** Etiqueta legible de la sección; si no se conoce, se devuelve tal cual */
  private seccionLabel(s: string | null | undefined): string {
    if (!s) return '—';
    return ETIQUETA_SECCION[s] ?? s;
  }

  /** Nombre del ítem del catálogo, con respaldo si no vino la relación */
  private nombreItem(linea: any): string {
    return linea?.catalogoItem?.nombre
      ?? `Ítem #${linea?.catalogoItemId ?? '?'}`;
  }

  /**
   * Componentes del kit en texto legible y en el orden fijo del enum,
   * por ejemplo "Motas, Escudo de grupo, Sector".
   */
  private componentesLegibles(componentes: ComponenteKit[] | null | undefined): string {
    const lista = Array.isArray(componentes) ? componentes : [];
    return lista
      .filter(c => COMPONENTES_KIT.includes(c))
      .sort((a, b) => COMPONENTES_KIT.indexOf(a) - COMPONENTES_KIT.indexOf(b))
      .map(c => ETIQUETA_COMPONENTE[c])
      .join(', ');
  }

  /**
   * Agrupa las líneas por categoría, respetando el orden de CATEGORIAS_CATALOGO.
   * Las líneas sin categoría reconocible caen en un grupo final "Otros ítems".
   */
  private agruparPorCategoria(lineas: SolicitudInsigniasLinea[]): GrupoCategoria[] {
    const porOrden = (a: any, b: any) => {
      const oa = a?.catalogoItem?.orden ?? 0;
      const ob = b?.catalogoItem?.orden ?? 0;
      if (oa !== ob) return oa - ob;
      return this.nombreItem(a).localeCompare(this.nombreItem(b), 'es');
    };

    const grupos: GrupoCategoria[] = [];
    for (const categoria of CATEGORIAS_CATALOGO) {
      const delGrupo = lineas
        .filter(l => (l as any)?.catalogoItem?.categoria === categoria)
        .sort(porOrden);
      if (delGrupo.length) {
        grupos.push({ titulo: ETIQUETA_CATEGORIA[categoria], lineas: delGrupo });
      }
    }

    const sueltas = lineas
      .filter(l => !CATEGORIAS_CATALOGO.includes((l as any)?.catalogoItem?.categoria))
      .sort(porOrden);
    if (sueltas.length) grupos.push({ titulo: 'Otros ítems', lineas: sueltas });

    return grupos;
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  /** Arma el documento PDF de la solicitud y lo devuelve como Buffer */
  async generatePdf(solicitud: SolicitudInsignias): Promise<Buffer> {
    const sol: any = solicitud ?? {};
    const lineas: SolicitudInsigniasLinea[] = Array.isArray(sol.lineas) ? sol.lineas : [];

    const caminanteNombre = this.nombreCompleto(
      sol.caminante,
      sol.caminanteId ? `Joven #${sol.caminanteId}` : '—',
    );
    const solicitanteNombre = this.nombreCompleto(sol.solicitante);
    const identidad = await this.secciones.identidadPdf(sol.seccion ?? sol.caminante?.seccion);
    aplicarPaleta(identidad);
    const seccionLabel = identidad.config ? identidad.nombre : this.seccionLabel(sol.seccion ?? sol.caminante?.seccion);
    const logoDerecha = identidad.logoDerecha;
    const fechaLabel   = this.fmtFecha(sol.fecha);
    const observaciones = (sol.observaciones ?? '').toString().trim() || 'Sin observaciones.';
    const folio = sol.id ? `FOLIO ${String(sol.id).padStart(4, '0')}` : 'BORRADOR';

    const hoy = new Date();
    const fechaCorta = hoy.toLocaleDateString('es-MX',
      { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
    const horaGen = hoy.toLocaleTimeString('es-MX',
      { hour: '2-digit', minute: '2-digit', timeZone: TZ });

    // ── helpers de tabla (mismo lenguaje visual que el informe mensual) ───────
    /** Título de sección: barra azul con filete dorado inferior. */
    const sectionTitle = (text: string) => ({
      table: { widths: ['*'], body: [
        [{ text, fontSize: 10, bold: true, alignment: 'left', characterSpacing: 0.6,
           fillColor: AZUL, color: WH, margin: [8, 5, 8, 5] }],
        [{ text: '', fillColor: ORO, margin: [0, 0, 0, 0], fontSize: 1.6 }],
      ] },
      layout: 'noBorders',
      margin: [0, 12, 0, 0],
    });

    const hdr = (text: string, opts: any = {}) => ({
      text, fontSize: 7.5, bold: true, alignment: 'center', characterSpacing: 0.3,
      fillColor: AZUL_MED, color: WH, margin: [2, 4, 2, 4], ...opts,
    });

    /** Par etiqueta / valor de la cabecera de datos */
    const dato = (etiqueta: string, valor: string) => ({
      stack: [
        { text: etiqueta.toUpperCase(), fontSize: 6.5, bold: true, color: TX_SUAVE,
          characterSpacing: 0.5, margin: [0, 0, 0, 2] },
        { text: valor, fontSize: 10, bold: true, color: AZUL },
      ],
    });

    // ── Tabla de ítems, agrupada por categoría ───────────────────────────────
    const grupos = this.agruparPorCategoria(lineas);
    const itemsBody: any[] = [[hdr('ÍTEM SOLICITADO', { alignment: 'left', margin: [4, 4, 2, 4] }),
                               hdr('CANT.')]];
    if (!grupos.length) {
      itemsBody.push([
        { text: 'Sin ítems en la solicitud.', fontSize: 8, italics: true, color: TX_SUAVE,
          margin: [4, 5, 4, 5], colSpan: 2 },
        {},
      ]);
    } else {
      for (const grupo of grupos) {
        itemsBody.push([
          { text: grupo.titulo.toUpperCase(), fontSize: 7.5, bold: true, color: AZUL,
            characterSpacing: 0.5, fillColor: AZUL_CLR, margin: [4, 3.5, 4, 3.5], colSpan: 2 },
          {},
        ]);
        for (const linea of grupo.lineas) {
          const detalle: any[] = [
            { text: this.nombreItem(linea), fontSize: 8.5, color: BK },
          ];
          // El kit de pañoleta enumera sus componentes en texto legible
          const componentes = this.componentesLegibles((linea as any).componentesKit);
          if (componentes) {
            detalle.push({ text: componentes, fontSize: 7, color: TX_SUAVE, margin: [0, 1.5, 0, 0] });
          }
          const notas = ((linea as any).notas ?? '').toString().trim();
          if (notas) {
            detalle.push({ text: notas, fontSize: 7, italics: true, color: ORO_OSC, margin: [0, 1.5, 0, 0] });
          }
          itemsBody.push([
            { stack: detalle, margin: [4, 3.5, 4, 3.5] },
            { text: String((linea as any).cantidad ?? 1), fontSize: 9, bold: true,
              alignment: 'center', color: AZUL, margin: [2, 3.5, 2, 3.5] },
          ]);
        }
      }
    }

    // ── Documento ─────────────────────────────────────────────────────────────
    const dd: any = {
      pageSize: 'LETTER',
      pageOrientation: 'portrait',
      pageMargins: [32, 30, 32, 46],
      info: {
        title:   `Solicitud de insignias — ${caminanteNombre}`,
        author:  solicitanteNombre,
        subject: `Solicitud de insignias — ${seccionLabel}`,
        creator: 'Grupo Scout 7 Morelia "Itsï Tarhiáta"',
      },
      defaultStyle: { font: 'Roboto', fontSize: 9, color: BK },
      images: {
        ...(this.logoGrupo ? { logoGrupo: this.logoGrupo } : {}),
        ...(logoDerecha ? { logoDerecha } : {}),
      },
      // ─ Pie de página: identidad, fecha de elaboración y folio de página ─
      footer: (currentPage: number, pageCount: number) => ({
        margin: [32, 8, 32, 0],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 548, y2: 0,
                       lineWidth: 0.8, lineColor: ORO }] },
          {
            columns: [
              { text: 'Grupo Scout 7 Morelia "Itsï Tarhiáta"  ·  Chupí-Tirípeme',
                fontSize: 6.5, color: TX_SUAVE, width: '*' },
              { text: `Elaborado el ${fechaCorta} · ${horaGen}`,
                fontSize: 6.5, color: TX_SUAVE, alignment: 'center', width: 'auto' },
              { text: `Página ${currentPage} de ${pageCount}`,
                fontSize: 6.5, color: TX_SUAVE, alignment: 'right', width: '*' },
            ],
            columnGap: 10,
            margin: [0, 3, 0, 0],
          },
        ],
      }),
      content: [
        // ─ Encabezado: logo del Grupo a la izquierda, de la Comunidad a la derecha ─
        {
          table: {
            widths: [74, '*', 88],
            body: [[
              this.logoGrupo
                ? { image: 'logoGrupo', width: 62, alignment: 'center', margin: [4, 8, 4, 8] }
                : { text: '⚜', fontSize: 26, color: ORO, alignment: 'center', margin: [0, 14, 0, 14] },
              {
                stack: [
                  { text: 'ASOCIACIÓN DE SCOUTS DE MÉXICO, A.C.', fontSize: 6.5, bold: true,
                    color: TX_SUAVE, characterSpacing: 1.1, alignment: 'center', margin: [0, 9, 0, 3] },
                  { text: 'SOLICITUD DE INSIGNIAS', fontSize: 15, bold: true,
                    color: AZUL, characterSpacing: 0.4, alignment: 'center' },
                  { canvas: [{ type: 'line', x1: 96, y1: 0, x2: 236, y2: 0,
                               lineWidth: 1.6, lineColor: ORO }], margin: [0, 4, 0, 4] },
                  { text: seccionLabel.toUpperCase(), fontSize: 10.5, bold: true,
                    color: AZUL_MED, alignment: 'center' },
                  { text: 'CHUPÍ-TIRÍPEME  ·  GRUPO SCOUT 7 MORELIA "ITSÏ TARHIÁTA"',
                    fontSize: 7.5, color: TX_SUAVE, alignment: 'center', margin: [0, 2, 0, 5] },
                  // Sello de folio centrado entre dos espaciadores flexibles
                  { columns: [
                      { width: '*', text: '' },
                      { width: 'auto',
                        table: { widths: ['auto'], body: [[{
                          text: folio,
                          fontSize: 9.5, bold: true, color: AZUL, fillColor: ORO,
                          margin: [14, 3, 14, 3], alignment: 'center',
                        }]] },
                        layout: 'noBorders' },
                      { width: '*', text: '' },
                    ], margin: [0, 0, 0, 9] },
                ],
              },
              logoDerecha
                ? identidad.logoDerechaHorizontal
                  ? { image: 'logoDerecha', width: 84, alignment: 'center', margin: [2, 8, 2, 8] }
                  : { image: 'logoDerecha', width: 52, height: 52, alignment: 'center', margin: [2, 8, 2, 8] }
                : { text: '⚜', fontSize: 26, color: ORO, alignment: 'center', margin: [0, 14, 0, 14] },
            ]],
          },
          layout: {
            hLineWidth: (i: number, node: any) => (i === node.table.body.length ? 2.4 : 0),
            vLineWidth: () => 0,
            hLineColor: () => AZUL,
            paddingLeft: () => 4, paddingRight: () => 4,
          },
        },
        // Filete dorado bajo el encabezado
        { canvas: [{ type: 'rect', x: 0, y: 0, w: 548, h: 2.2, color: ORO }], margin: [0, 1.5, 0, 0] },

        // ─ Cabecera de datos ─
        sectionTitle('DATOS DE LA SOLICITUD'),
        {
          table: {
            widths: ['*', '*'],
            body: [
              [dato('Caminante', caminanteNombre), dato('Fecha', fechaLabel)],
              [dato('Sección', seccionLabel),      dato('Solicita', solicitanteNombre)],
            ],
          },
          layout: {
            hLineWidth: (i: number, node: any) =>
              (i === 0 || i === node.table.body.length ? 0 : 0.4),
            vLineWidth: () => 0,
            hLineColor: () => LINEA,
            paddingLeft: () => 2, paddingRight: () => 2,
            paddingTop: () => 6, paddingBottom: () => 6,
          },
          margin: [0, 8, 0, 0],
        },
        {
          stack: [
            { text: 'OBSERVACIONES', fontSize: 6.5, bold: true, color: TX_SUAVE,
              characterSpacing: 0.5, margin: [0, 0, 0, 3] },
            { text: observaciones, fontSize: 8.5, color: BK },
          ],
          margin: [0, 6, 0, 0],
        },

        // ─ Ítems solicitados, agrupados por categoría ─
        sectionTitle('ÍTEMS SOLICITADOS'),
        {
          table: { widths: ['*', 56], body: itemsBody, headerRows: 1 },
          layout: {
            hLineWidth: (i: number, node: any) =>
              (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
            vLineWidth: () => 0,
            hLineColor: (i: number, node: any) =>
              (i === 0 || i === 1 || i === node.table.body.length ? AZUL_MED : LINEA),
            paddingLeft:  () => 2,
            paddingRight: () => 2,
          },
          margin: [0, 6, 0, 0],
        },
      ],
    };

    const doc = await this.printer.createPdfKitDocument(dd);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
