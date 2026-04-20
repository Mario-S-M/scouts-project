import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { AvisoSalidaDto, ParticipanteDto } from './dto/aviso-salida.dto';
import { AvisoSalida } from './aviso-salida.entity';

const PdfPrinter = require('pdfmake/js/Printer').default;
const vfsFonts = require('pdfmake/build/vfs_fonts');

// ── Colores ────────────────────────────────────────────────────────────────────
const C = {
  purple:      '#5B21B6',
  purpleLight: '#EDE9FE',
  cream:       '#F9F5F0',
  border:      '#D8D0F0',
  gray:        '#6B7280',
  grayLight:   '#F3F4F6',
  white:       '#FFFFFF',
  text:        '#1E1E2E',
  secciones: {
    manada:    { bg: '#FBBF24', text: '#000000', light: '#FFFBEB', label: 'LOBATOS' },
    tropa:     { bg: '#16A34A', text: '#FFFFFF', light: '#F0FFF4', label: 'SCOUTS' },
    comunidad: { bg: '#2563EB', text: '#FFFFFF', light: '#EFF6FF', label: 'CAMINANTES' },
    clan:      { bg: '#DC2626', text: '#FFFFFF', light: '#FFF5F5', label: 'ROVERS' },
  } as Record<string, { bg: string; text: string; light: string; label: string }>,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateLong(s: string | null | undefined): string {
  if (!s) return '—';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dias  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
}

function fmtTime(s: string | null | undefined): string {
  if (!s) return '—';
  if (/^\d{2}:\d{2}/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—'
    : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

@Injectable()
export class AvisosSalidaService {
  private printer: any;
  private logoGrupo: string | null = null;
  private logoCC:    string | null = null;

  constructor(
    @InjectRepository(AvisoSalida)
    private readonly repo: Repository<AvisoSalida>,
  ) {
    const assetsDir = path.join(__dirname, '../../public/assets');
    const grupoPath = path.join(assetsDir, 'logo_Grupo.png');
    const ccPath    = path.join(assetsDir, 'logo_CC.png');
    if (fs.existsSync(grupoPath)) this.logoGrupo = `data:image/png;base64,${fs.readFileSync(grupoPath).toString('base64')}`;
    if (fs.existsSync(ccPath))    this.logoCC    = `data:image/png;base64,${fs.readFileSync(ccPath).toString('base64')}`;

    // pdfmake v0.3: resolveUrls() calls getExtendedUrl(descriptor) which does
    // descriptor.url — a Buffer is an object, so it'd read Buffer.url = undefined.
    // Fix: use string keys + virtualfs so resolveUrls treats them as plain paths.
    const fontBuffers: Record<string, Buffer> = {
      'Roboto-Regular.ttf':      Buffer.from(vfsFonts['Roboto-Regular.ttf'],      'base64'),
      'Roboto-Medium.ttf':       Buffer.from(vfsFonts['Roboto-Medium.ttf'],       'base64'),
      'Roboto-Italic.ttf':       Buffer.from(vfsFonts['Roboto-Italic.ttf'],       'base64'),
      'Roboto-MediumItalic.ttf': Buffer.from(vfsFonts['Roboto-MediumItalic.ttf'], 'base64'),
    };
    const fonts = {
      Roboto: {
        normal:      'Roboto-Regular.ttf',
        bold:        'Roboto-Medium.ttf',
        italics:     'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };
    const virtualfs = {
      existsSync:   (key: string) => key in fontBuffers,
      readFileSync: (key: string) => fontBuffers[key],
    };
    const urlResolver = {
      resolve:  (_url: any, _headers: any) => {},
      resolved: () => Promise.resolve(),
    };
    this.printer = new PdfPrinter(fonts, virtualfs, urlResolver);
  }

  // ── Parsear coordenadas de un link de Google Maps ────────────────────────────
  private parseCoords(url: string): { lat: number; lon: number; zoom: number } | null {
    // Formato: @lat,lon,zoomz  (el más común en links compartidos)
    const at = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+),(\d+)/);
    if (at) return { lat: +at[1], lon: +at[2], zoom: Math.min(+at[3], 17) };
    // Formato: ?q=lat,lon  o  &query=lat,lon
    const q = url.match(/[?&](?:q|query)=(-?\d+\.?\d+),(-?\d+\.?\d+)/);
    if (q) return { lat: +q[1], lon: +q[2], zoom: 15 };
    return null;
  }

  // ── Resolver links cortos (maps.app.goo.gl → URL completa) ───────────────────
  private async resolveShortUrl(url: string): Promise<string> {
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      return res.url || url;
    } catch {
      return url;
    }
  }

  // ── Componer mapa estático desde tiles de OSM ────────────────────────────────
  private async fetchMapImage(googleUrl: string): Promise<string | null> {
    try {
      // 1. Resolver link corto si aplica
      const resolvedUrl = /goo\.gl\/|maps\.app\.goo\.gl/.test(googleUrl)
        ? await this.resolveShortUrl(googleUrl)
        : googleUrl;

      const coords = this.parseCoords(resolvedUrl);
      if (!coords) return null;

      const sharp = require('sharp');
      const { lat, lon } = coords;
      // Fetchar tiles en zoom 15 (área de zoom 13, 4× resolución para PDF nítido)
      const displayZoom = Math.min(coords.zoom, 13);
      const fetchZoom   = displayZoom + 2;
      // Imagen final grande: pdfmake la escala hacia abajo → muy nítida en impresión
      const W = 1500, H = 780, TILE = 256;
      const W2 = W, H2 = H; // sin segundo escale, directo al tamaño final

      // 2. Posición flotante del punto en cuadrícula de tiles (al zoom de fetch)
      const n = Math.pow(2, fetchZoom);
      const tileX = (lon + 180) / 360 * n;
      const latRad = lat * Math.PI / 180;
      const tileY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

      // 3. Rango de tiles (pad grande para cubrir el área 4×)
      const pad = 7;
      const minTX = Math.floor(tileX) - pad;
      const maxTX = Math.floor(tileX) + pad;
      const minTY = Math.floor(tileY) - pad;
      const maxTY = Math.floor(tileY) + pad;

      // 4. Descargar tiles en paralelo
      const fetchTile = async (tx: number, ty: number) => {
        const url = `https://tile.openstreetmap.org/${fetchZoom}/${tx}/${ty}.png`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'ScoutsApp/1.0 (educational use)' },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return null;
        return { tx, ty, buf: Buffer.from(await res.arrayBuffer()) };
      };

      const jobs: Promise<any>[] = [];
      for (let ty = minTY; ty <= maxTY; ty++) {
        for (let tx = minTX; tx <= maxTX; tx++) {
          jobs.push(fetchTile(tx, ty));
        }
      }
      const tiles = (await Promise.all(jobs)).filter(Boolean);

      // 5. Componer grid completo
      const gridW = (maxTX - minTX + 1) * TILE;
      const gridH = (maxTY - minTY + 1) * TILE;
      const composites = tiles.map(({ tx, ty, buf }) => ({
        input: buf,
        left: (tx - minTX) * TILE,
        top:  (ty - minTY) * TILE,
      }));
      const grid = await sharp({
        create: { width: gridW, height: gridH, channels: 3, background: '#e8e0d8' },
      }).png().composite(composites).toBuffer();

      // 6. Recortar W2×H2 centrado en el punto (canvas 2×)
      const centerPxX = Math.round((tileX - minTX) * TILE);
      const centerPxY = Math.round((tileY - minTY) * TILE);
      const left = Math.min(Math.max(0, centerPxX - Math.floor(W2 / 2)), gridW - W2);
      const top  = Math.min(Math.max(0, centerPxY - Math.floor(H2 / 2)), gridH - H2);
      const cropped2x = await sharp(grid)
        .extract({ left, top, width: W2, height: H2 })
        .toBuffer();

      // 7. Marcador rojo proporcional al canvas grande
      const mx = Math.floor(W / 2), my = Math.floor(H / 2);
      const markerSvg = Buffer.from(
        `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
        `<circle cx="${mx}" cy="${my}" r="22" fill="#DC2626" stroke="white" stroke-width="6"/>` +
        `<circle cx="${mx}" cy="${my}" r="8" fill="white"/>` +
        `</svg>`
      );

      // 8. Componer marcador — sin resize, entregamos imagen grande directamente
      const result = await sharp(cropped2x)
        .composite([{ input: markerSvg, left: 0, top: 0 }])
        .png({ compressionLevel: 6 })
        .toBuffer();

      return `data:image/png;base64,${result.toString('base64')}`;
    } catch (e) {
      console.error('[MAP] fetchMapImage error:', e);
      return null;
    }
  }

  async generatePdf(dto: AvisoSalidaDto): Promise<Buffer> {
    const mapImage = dto.mapUrl ? await this.fetchMapImage(dto.mapUrl) : null;
    const docDef = this.buildDocument(dto, mapImage);
    // In pdfmake v0.3, createPdfKitDocument returns a Promise<PDFDocument>
    const doc = await this.printer.createPdfKitDocument(docDef);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  // ── Documento completo ───────────────────────────────────────────────────────
  private buildDocument(dto: AvisoSalidaDto, mapImage?: string | null): any {
    const scoutersValidos = (dto.scouters ?? []).filter(s => s.nombre?.trim());
    const invitadosValidos = (dto.invitados ?? []).filter(i => i.nombre?.trim());
    const participantes = dto.participantes ?? [];
    const totalAsistentes = participantes.length + scoutersValidos.length + invitadosValidos.length;

    const counts = {
      lobatos:    participantes.filter(p => p.seccion === 'manada').length,
      scouts:     participantes.filter(p => p.seccion === 'tropa').length,
      caminantes: participantes.filter(p => p.seccion === 'comunidad').length,
      rovers:     participantes.filter(p => p.seccion === 'clan').length,
      total:      participantes.length,
    };

    return {
      pageSize: 'A4',
      pageMargins: [32, 32, 32, 32],
      background: (_page: number, size: any) => ({
        canvas: [{ type: 'rect', x: 0, y: 0, w: size.width, h: size.height, color: C.cream }],
      }),
      defaultStyle: { font: 'Roboto', fontSize: 9, color: C.text },
      styles: this.styles(),
      images: {
        ...(mapImage               ? { mapImg:    mapImage        } : {}),
        ...(this.logoGrupo         ? { logoGrupo: this.logoGrupo  } : {}),
        ...(this.logoCC            ? { logoCC:    this.logoCC     } : {}),
      },
      content: [
        // ─ Página 1: Aviso de Salida ─
        this.header(),
        this.titlePill('AVISO DE SALIDA'),
        this.topGrid(dto, counts, scoutersValidos.length),
        this.separator(),
        this.transportGrid(dto),
        this.separator(),
        this.contactGrid(dto),
        this.separator(),
        this.lugarSection(dto, mapImage),

        // ─ Página 2: Lista de Asistentes ─
        { text: '', pageBreak: 'before' },
        this.header(),
        this.titlePillWithBadge('LISTA DE ASISTENTES', totalAsistentes),
        this.separator(),
        scoutersValidos.length ? this.scoutersSection(scoutersValidos) : null,
        ...['manada', 'tropa', 'comunidad', 'clan'].map(sec =>
          this.seccionTable(participantes.filter(p => p.seccion === sec), sec),
        ).filter(Boolean),
        invitadosValidos.length ? this.invitadosSection(invitadosValidos) : null,
        this.firmas(),
      ].filter(Boolean),
    };
  }

  // ── Estilos ──────────────────────────────────────────────────────────────────
  private styles() {
    return {
      headerTitle: { fontSize: 11, bold: true, color: C.white },
      headerSub:   { fontSize: 9,  color: C.white },
      pill:        { fontSize: 8,  bold: true, color: C.white },
      sectionLabel:{ fontSize: 8,  bold: true },
      bullet:      { fontSize: 9 },
      tableHeader: { fontSize: 8, bold: true },
    };
  }

  // ── Encabezado institucional ─────────────────────────────────────────────────
  private header(): any {
    const leftCell = this.logoGrupo
      ? { image: 'logoGrupo', width: 48, alignment: 'center', fillColor: C.white, margin: [4, 4, 4, 4] }
      : { text: '⚜', fontSize: 22, alignment: 'center', color: C.white, fillColor: C.purple, margin: [4, 10, 4, 10] };
    const rightCell = this.logoCC
      ? { image: 'logoCC', width: 48, alignment: 'center', fillColor: C.white, margin: [4, 4, 4, 4] }
      : { text: '⚜', fontSize: 22, alignment: 'center', color: C.white, fillColor: C.purple, margin: [4, 10, 4, 10] };
    return {
      table: {
        widths: [60, '*', 60],
        body: [[
          leftCell,
          {
            stack: [
              { text: 'ASOCIACIÓN DE SCOUTS DE MÉXICO, A.C.', style: 'headerTitle', alignment: 'center' },
              { text: 'PROVINCIA MICHOACÁN  ·  GRUPO 7 MORELIA', style: 'headerSub', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
            fillColor: C.purple,
            margin: [0, 8, 0, 8],
          },
          rightCell,
        ]],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8],
    };
  }

  // ── Título pill ──────────────────────────────────────────────────────────────
  private titlePill(text: string): any {
    return {
      table: {
        widths: ['*'],
        body: [[{
          text, style: 'headerTitle', alignment: 'center',
          fillColor: C.purple, margin: [0, 6, 0, 6],
        }]],
      },
      layout: 'noBorders',
      margin: [60, 0, 60, 8],
    };
  }

  private titlePillWithBadge(text: string, total: number): any {
    return {
      columns: [
        { width: '*', text: '' },
        {
          width: 'auto',
          table: {
            widths: ['*'],
            body: [[{
              text, style: 'headerTitle', alignment: 'center',
              fillColor: C.purple, margin: [24, 6, 24, 6],
            }]],
          },
          layout: 'noBorders',
        },
        {
          width: 'auto',
          table: {
            widths: [30],
            body: [[{
              text: `${total}`,
              fontSize: 14, bold: true, color: C.purple,
              alignment: 'center', margin: [0, 4, 0, 4],
            }]],
          },
          layout: { hLineColor: () => C.purple, vLineColor: () => C.purple, hLineWidth: () => 1.5, vLineWidth: () => 1.5 },
          margin: [6, 0, 0, 0],
        },
        { width: '*', text: '' },
      ],
      margin: [0, 0, 0, 8],
    };
  }

  // ── Separador ────────────────────────────────────────────────────────────────
  private separator(): any {
    return {
      columns: [
        { width: '*', canvas: [{ type: 'line', x1: 0, y1: 4, x2: 160, y2: 4, lineWidth: 0.5, lineColor: C.border }] },
        { width: 'auto', text: ' ◆  ○  ○  ◆ ', color: C.purple, fontSize: 9, margin: [0, -2, 0, 0] },
        { width: '*', canvas: [{ type: 'line', x1: 0, y1: 4, x2: 160, y2: 4, lineWidth: 0.5, lineColor: C.border }] },
      ],
      margin: [0, 4, 0, 6],
    };
  }

  // ── Pill de sección ───────────────────────────────────────────────────────────
  private pill(text: string, fill = C.purple, color = C.white): any {
    return {
      table: { widths: ['*'], body: [[{ text: text.toUpperCase(), fillColor: fill, color, bold: true, fontSize: 8, alignment: 'center', margin: [4, 2, 4, 2] }]] },
      layout: 'noBorders',
      margin: [0, 0, 0, 4],
    };
  }

  // ── Caja de contenido ────────────────────────────────────────────────────────
  private box(content: any): any {
    return {
      table: { widths: ['*'], body: [[{ stack: Array.isArray(content) ? content : [content], margin: [6, 4, 6, 4], fillColor: C.white }]] },
      layout: { hLineColor: () => C.border, vLineColor: () => C.border, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
      margin: [0, 0, 0, 4],
    };
  }

  // ── Grid superior: Tipo+Nombre | Muchachos | Adultos ─────────────────────────
  private topGrid(dto: AvisoSalidaDto, counts: any, numScouters: number): any {
    const countRow = (num: number, sec: keyof typeof C.secciones) => ({
      columns: [
        { width: 20, text: `${num}`, bold: true, fontSize: 11, alignment: 'center' },
        {
          width: '*',
          table: { widths: ['*'], body: [[{ text: C.secciones[sec].label, fillColor: C.secciones[sec].bg, color: C.secciones[sec].text, bold: true, fontSize: 8, alignment: 'center', margin: [2, 2, 2, 2] }]] },
          layout: 'noBorders',
        },
      ],
      margin: [0, 2, 0, 2],
    });

    return {
      table: {
        widths: ['28%', '47%', '25%'],
        body: [[
          // Tipo + Nombre
          {
            stack: [
              this.pill('TIPO'),
              { text: dto.tipo || '—', margin: [4, 0, 4, 6] },
              this.pill('NOMBRE'),
              { text: dto.nombre || '—', margin: [4, 0, 4, 4] },
            ],
            fillColor: C.white, margin: [6, 6, 6, 6],
          },
          // Muchachos
          {
            stack: [
              this.pill('MUCHACHOS DEL GRUPO'),
              countRow(counts.lobatos,    'manada'),
              countRow(counts.scouts,     'tropa'),
              countRow(counts.caminantes, 'comunidad'),
              countRow(counts.rovers,     'clan'),
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: C.border }], margin: [0, 2, 0, 2] },
              {
                columns: [
                  { width: 20, text: `${counts.total}`, bold: true, fontSize: 13, alignment: 'center' },
                  {
                    width: '*',
                    table: { widths: ['*'], body: [[{ text: 'MUCHACHOS', fillColor: C.purple, color: C.white, bold: true, fontSize: 8, alignment: 'center', margin: [2, 2, 2, 2] }]] },
                    layout: 'noBorders',
                  },
                ],
                margin: [0, 2, 0, 2],
              },
            ],
            fillColor: C.white, margin: [6, 6, 6, 6],
          },
          // Adultos
          {
            stack: [
              this.pill('ADULTOS'),
              { text: `${numScouters}`, bold: true, fontSize: 24, alignment: 'center', margin: [0, 4, 0, 2] },
              {
                table: { widths: ['*'], body: [[{ text: 'SCOUTERS', fillColor: C.gray, color: C.white, bold: true, fontSize: 8, alignment: 'center', margin: [2, 2, 2, 2] }]] },
                layout: 'noBorders',
              },
              { text: '*Ver lista anexa', color: C.gray, fontSize: 8, italics: true, alignment: 'center', margin: [0, 6, 0, 0] },
            ],
            fillColor: C.white, margin: [6, 6, 6, 6],
          },
        ]],
      },
      layout: { hLineColor: () => C.border, vLineColor: () => C.border, hLineWidth: () => 0.7, vLineWidth: () => 0.7 },
      margin: [0, 0, 0, 4],
    };
  }

  // ── Grid transporte: Salida | Transporte | Llegada ────────────────────────────
  private transportGrid(dto: AvisoSalidaDto): any {
    const bulletList = (items: [string, string][]) =>
      items.map(([k, v]) => ({ text: [{ text: `${k}: `, bold: true }, v], style: 'bullet', margin: [0, 1, 0, 1] }));

    return {
      table: {
        widths: ['33%', '34%', '33%'],
        body: [[
          {
            stack: [this.pill('SALIDA'), ...bulletList([
              ['Lugar', dto.salida?.lugar || '—'],
              ['Fecha', fmtDate(dto.salida?.fecha)],
              ['Hora',  fmtTime(dto.salida?.hora)],
            ])],
            fillColor: C.white, margin: [6, 6, 6, 6],
          },
          {
            stack: [
              this.pill('TRANSPORTE'),
              { text: dto.transporte || '—', alignment: 'center', italics: true, margin: [4, 6, 4, 6] },
            ],
            fillColor: C.white, margin: [6, 6, 6, 6],
          },
          {
            stack: [this.pill('LLEGADA'), ...bulletList([
              ['Lugar', dto.llegada?.lugar || '—'],
              ['Fecha', fmtDate(dto.llegada?.fecha)],
              ['Hora',  fmtTime(dto.llegada?.hora)],
            ])],
            fillColor: C.white, margin: [6, 6, 6, 6],
          },
        ]],
      },
      layout: { hLineColor: () => C.border, vLineColor: () => C.border, hLineWidth: () => 0.7, vLineWidth: () => 0.7 },
      margin: [0, 0, 0, 4],
    };
  }

  // ── Grid contactos: En el Local | En Actividad ───────────────────────────────
  private contactGrid(dto: AvisoSalidaDto): any {
    const contactBlock = (label: string, c: any) => ({
      stack: [
        this.pill(label),
        { text: [{ text: 'Nombre: ',   bold: true }, c?.nombre   || '—'], margin: [0, 2, 0, 1] },
        { text: [{ text: 'Cargo: ',    bold: true }, c?.cargo    || '—'], margin: [0, 1, 0, 1] },
        { text: [{ text: 'Teléfono: ', bold: true }, c?.telefono || '—'], margin: [0, 1, 0, 2] },
      ],
      fillColor: C.white, margin: [6, 6, 6, 6],
    });

    return {
      table: {
        widths: ['50%', '50%'],
        body: [[
          contactBlock('EN EL LOCAL',   dto.contactoLocal),
          contactBlock('EN ACTIVIDAD',  dto.contactoActividad),
        ]],
      },
      layout: { hLineColor: () => C.border, vLineColor: () => C.border, hLineWidth: () => 0.7, vLineWidth: () => 0.7 },
      margin: [0, 0, 0, 4],
    };
  }

  // ── Sección Lugar ─────────────────────────────────────────────────────────────
  private lugarSection(dto: AvisoSalidaDto, mapImage?: string | null): any {
    return {
      stack: [
        this.pill('LUGAR'),
        this.box([
          { text: dto.lugarDescripcion || 'Sin descripción adicional del lugar de la actividad.', margin: [0, 2, 0, mapImage ? 6 : 2] },
          mapImage ? { image: 'mapImg', width: 490, alignment: 'center' } : null,
        ].filter(Boolean)),
      ],
    };
  }

  // ── Sección Scouters ──────────────────────────────────────────────────────────
  private scoutersSection(scouters: any[]): any {
    return {
      stack: [
        this.pill('SCOUTERS / DIRIGENTES DEL GRUPO 7'),
        {
          columns: scouters.map(s => ({
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  { text: [{ text: 'Nombre: ', bold: true }, s.nombre] },
                  s.cum ? { text: [{ text: 'CUM: ', bold: true }, s.cum] } : null,
                ].filter(Boolean),
                fillColor: C.purpleLight, margin: [6, 4, 6, 4],
              }]],
            },
            layout: { hLineColor: () => C.border, vLineColor: () => C.border, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
          })),
          columnGap: 8,
        },
      ],
      margin: [0, 0, 0, 10],
    };
  }

  // ── Tabla de participantes por sección ────────────────────────────────────────
  private seccionTable(participantes: ParticipanteDto[], seccion: string): any {
    if (!participantes.length) return null;
    const color = C.secciones[seccion];
    if (!color) return null;

    return {
      stack: [
        this.pill(color.label, color.bg, color.text),
        {
          table: {
            headerRows: 1,
            widths: [16, '*', 70, 60],
            body: [
              [
                { text: '#',              fillColor: color.bg, color: color.text, bold: true, fontSize: 8, alignment: 'center', margin: [2, 3, 2, 3] },
                { text: 'Nombre',         fillColor: color.bg, color: color.text, bold: true, fontSize: 8, margin: [2, 3, 2, 3] },
                { text: 'CUM',            fillColor: color.bg, color: color.text, bold: true, fontSize: 8, alignment: 'center', margin: [2, 3, 2, 3] },
                { text: 'Fecha de Nac.',  fillColor: color.bg, color: color.text, bold: true, fontSize: 8, alignment: 'center', margin: [2, 3, 2, 3] },
              ],
              ...participantes.map((p, i) => [
                { text: `${i + 1}`, alignment: 'center', fontSize: 8 },
                { text: `${p.nombre} ${p.apellidos || ''}`.trim(), fillColor: color.light, fontSize: 8 },
                { text: p.cum || '—', alignment: 'center', fontSize: 8 },
                { text: fmtDate(p.fechaNacimiento), alignment: 'center', fontSize: 8 },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
      margin: [0, 0, 0, 10],
    };
  }

  // ── Sección Invitados ─────────────────────────────────────────────────────────
  private invitadosSection(invitados: any[]): any {
    return {
      stack: [
        this.pill('INVITADOS / INVITADAS'),
        {
          table: {
            headerRows: 1,
            widths: [16, '*', 80],
            body: [
              [
                { text: '#',      fillColor: C.gray, color: C.white, bold: true, fontSize: 8, alignment: 'center', margin: [2, 3, 2, 3] },
                { text: 'Nombre', fillColor: C.gray, color: C.white, bold: true, fontSize: 8, margin: [2, 3, 2, 3] },
                { text: 'CUM/ID', fillColor: C.gray, color: C.white, bold: true, fontSize: 8, alignment: 'center', margin: [2, 3, 2, 3] },
              ],
              ...invitados.map((inv, i) => [
                { text: `${i + 1}`, alignment: 'center', fontSize: 8 },
                { text: inv.nombre, fontSize: 8 },
                { text: inv.cum || '—', alignment: 'center', fontSize: 8 },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
      margin: [0, 0, 0, 10],
    };
  }

  // ── Firmas ───────────────────────────────────────────────────────────────────
  private firmas(): any {
    const firma = (label: string) => ({
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 180, y2: 0, lineWidth: 1, lineColor: C.text }] },
        { text: label, fontSize: 8, alignment: 'center', margin: [0, 4, 0, 0] },
      ],
    });

    return {
      columns: [
        { width: '*', text: '' },
        firma('Jefe(a) de Grupo'),
        { width: 40, text: '' },
        firma('Responsable en Actividad'),
        { width: '*', text: '' },
      ],
      margin: [0, 20, 0, 0],
    };
  }

  // ── Permisos de Salida ────────────────────────────────────────────────────────

  async generatePermisos(id: number): Promise<Buffer> {
    const aviso  = await this.findOne(id);
    const docDef = this.buildPermisosDocument(aviso.data as AvisoSalidaDto);
    const doc    = await this.printer.createPdfKitDocument(docDef);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data',  (c: Buffer) => chunks.push(c));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  private buildPermisosDocument(dto: AvisoSalidaDto): any {
    const participantes = dto.participantes ?? [];
    const costo: number = dto.costo ?? 0;
    const targets: (ParticipanteDto | null)[] = participantes.length > 0 ? participantes : [null];

    const content: any[] = [];
    targets.forEach((p, i) => {
      if (i > 0) content.push({ text: '', pageBreak: 'before' });
      content.push(...this.buildPermisoPage(dto, p, costo));
    });

    return {
      pageSize:     'LETTER',
      pageMargins:  [36, 36, 36, 28],
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#111827' },
      images: {
        ...(this.logoGrupo ? { logoGrupo: this.logoGrupo } : {}),
        ...(this.logoCC    ? { logoCC:    this.logoCC    } : {}),
      },
      content,
    };
  }

  private buildPermisoPage(dto: AvisoSalidaDto, p: ParticipanteDto | null, costo: number): any[] {
    // ─ Paleta ─────────────────────────────────────────────────────────────────
    const NAVY    = '#1E3A8A';
    const NAVY2   = '#1E40AF';
    const BLUE_LT = '#EFF6FF';
    const BLUE_MD = '#DBEAFE';
    const WHITE   = '#FFFFFF';
    const INPUT   = '#F8FAFC';
    const BORDER  = '#CBD5E1';
    const TEXT    = '#1E293B';
    const GRAY    = '#64748B';

    const nombreJoven     = p ? `${p.nombre || ''} ${p.apellidos || ''}`.trim() : '';
    const cum             = p?.cum ?? '';
    const nombreActividad = (dto.nombre || '—').toUpperCase();
    const fechaLarga      = fmtDateLong(dto.salida?.fecha);
    const contactos       = [dto.contactoLocal, dto.contactoActividad].filter(c => c?.nombre?.trim());

    // ─ Helpers ────────────────────────────────────────────────────────────────
    // Campo de entrada con highlight si tiene valor
    const ibox = (val = '', ph = '') => ({
      table: {
        widths: ['*'],
        body: [[{
          text: val || ph || ' ',
          fontSize: 8.5,
          color:   val ? TEXT : GRAY,
          fillColor: val ? WHITE : INPUT,
          margin: [4, 2, 4, 2],
          italics: !val && !!ph,
          bold: !!val,
        }]],
      },
      layout: {
        hLineColor: () => val ? NAVY : BORDER,
        vLineColor: () => val ? NAVY : BORDER,
        hLineWidth: () => val ? 1 : 0.5,
        vLineWidth: () => val ? 1 : 0.5,
      },
    });
    // Casilla de verificación
    const cbox = () => ({
      table: { widths: [11], body: [[{ text: ' ', fillColor: INPUT, margin: [0, 2, 0, 2] }]] },
      layout: { hLineColor: () => BORDER, vLineColor: () => BORDER, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
      width: 15,
    });
    // Encabezado de sección (barra azul marino)
    const secHdr = (txt: string) => ({
      table: { widths: ['*'], body: [[{ text: txt, fontSize: 7.5, bold: true, color: WHITE, fillColor: NAVY, alignment: 'center', margin: [0, 3, 0, 3] }]] },
      layout: 'noBorders',
      margin: [0, 0, 0, 0],
    });
    // Separador fino azul claro
    const sep = () => ({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 523, y2: 0, lineWidth: 0.5, lineColor: BLUE_MD }],
      margin: [0, 3, 0, 3],
    });
    // Separador grueso azul marino
    const navyLine = () => ({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 2, lineColor: NAVY }],
      margin: [0, 0, 0, 0],
    });
    const divider = sep;
    const thick = navyLine;

    return [
      // ─ Header bar ─
      {
        columns: [
          { width: '*',    text: fechaLarga,         fontSize: 7.5, color: '#6B7280' },
          { width: 'auto', text: 'PERMISO DE SALIDA', fontSize: 7.5, bold: true, color: '#6B7280' },
        ],
        margin: [0, 0, 0, 4],
      },

      // ─ Logos + nombre grupo ─
      {
        columns: [
          this.logoGrupo
            ? { width: 54, image: 'logoGrupo', fit: [50, 50] as [number, number], alignment: 'center' }
            : { width: 54, text: '' },
          {
            width: '*',
            stack: [
              { text: 'Comunidad de Caminantes',  fontSize: 13, bold: true,   color: NAVY, alignment: 'center' },
              { text: '::: Chupí-Tiripeme :::',   fontSize: 8,               color: NAVY, alignment: 'center', margin: [0, 2, 0, 0] },
              { text: 'GRUPO 7',                   fontSize: 8,  bold: true,               alignment: 'center', margin: [0, 3, 0, 0] },
              { text: 'Itsï Tarhiata',             fontSize: 8,  italics: true,             alignment: 'center' },
            ],
            margin: [0, 2, 0, 2],
          },
          {
            width: 50,
            stack: [{ text: `$${costo}`, fontSize: 20, bold: true, color: NAVY, alignment: 'center', margin: [0, 8, 0, 0] }],
          },
          this.logoCC
            ? { width: 54, image: 'logoCC', fit: [50, 50] as [number, number], alignment: 'center' }
            : { width: 54, text: '' },
        ],
        margin: [0, 0, 0, 4],
      },

      divider(),

      // ─ Título actividad ─
      {
        stack: [
          { text: 'ACTIVIDAD', fontSize: 7.5, bold: true, color: GRAY, alignment: 'center' },
          { text: nombreActividad, fontSize: 12, bold: true, color: NAVY, alignment: 'center', margin: [0, 1, 0, 0] },
        ],
        margin: [0, 2, 0, 3],
      },

      divider(),

      // ─ Llegada / Salida ─
      {
        table: {
          widths: ['50%', '50%'],
          body: [[
            {
              stack: [
                { text: 'Llegada:', bold: true, fontSize: 9 },
                { text: [{ text: '• Punto de Reunión: ', bold: true }, dto.salida?.lugar || '—'],        fontSize: 8, margin: [0, 2, 0, 1] },
                { text: [{ text: '• Horario: ',          bold: true }, fmtTime(dto.salida?.hora)],       fontSize: 8, margin: [0, 1, 0, 1] },
                { text: [{ text: '• Fecha: ',            bold: true }, fmtDateLong(dto.salida?.fecha)],  fontSize: 8, margin: [0, 1, 0, 1] },
              ],
              fillColor: BLUE_LT, margin: [6, 5, 6, 5],
            },
            {
              stack: [
                { text: 'Salida:', bold: true, fontSize: 9 },
                { text: [{ text: '• Punto de Reunión: ', bold: true }, dto.llegada?.lugar || dto.salida?.lugar || '—'], fontSize: 8, margin: [0, 2, 0, 1] },
                { text: [{ text: '• Horario: ',          bold: true }, fmtTime(dto.llegada?.hora)],       fontSize: 8, margin: [0, 1, 0, 1] },
                { text: [{ text: '• Fecha: ',            bold: true }, fmtDateLong(dto.llegada?.fecha)],  fontSize: 8, margin: [0, 1, 0, 1] },
              ],
              fillColor: BLUE_LT, margin: [6, 5, 6, 5],
            },
          ]],
        },
        layout: { hLineColor: () => NAVY, vLineColor: () => NAVY, hLineWidth: () => 0.8, vLineWidth: () => 0.8 },
        margin: [0, 0, 0, 6],
      },

      // ─ AUTORIZO ─
      {
        columns: [
          { width: 'auto', text: [{ text: 'AUTORIZO', bold: true }, ' a mi hijo (a):'], fontSize: 9 },
          { ...ibox(nombreJoven), width: '*', margin: [4, 0, 0, 0] },
        ],
        margin: [0, 0, 0, 3],
      },
      {
        text: 'para que asista a esta actividad. Proporcionando además los siguientes datos para en caso de emergencia:',
        fontSize: 8.5, margin: [0, 0, 0, 5],
      },

      // ─ Sangre + Teléfono ─
      {
        columns: [
          { width: 'auto', text: ['Su tipo de ', { text: 'sangre', bold: true }, ' es:'], fontSize: 8.5 },
          { ...ibox(), width: 50, margin: [4, 0, 10, 0] },
          { width: 'auto', text: [{ text: 'Teléfono', bold: true }, ' de emergencia:'], fontSize: 8.5 },
          { ...ibox(), width: '*', margin: [4, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 2, 0, 2],
      },

      // ─ Alergias ─
      {
        columns: [
          { width: 'auto', text: [{ text: 'Alergias', bold: true }, ':'], fontSize: 8.5 },
          { ...cbox(), margin: [4, 0, 6, 0] },
          { width: 'auto', text: 'Especifique:', fontSize: 8.5 },
          { ...ibox(), width: '*', margin: [4, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 2, 0, 2],
      },

      // ─ Problemas de salud ─
      {
        columns: [
          { width: 'auto', text: [{ text: 'Problemas graves de Salud', bold: true }, ' que le impidan realizar alguna actividad:'], fontSize: 8.5 },
          { ...ibox(), width: '*', margin: [4, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 2, 0, 2],
      },

      // ─ Medicamentos ─
      {
        columns: [
          { width: 'auto', text: [{ text: 'Medicamentos', bold: true }, ' que actualmente está tomando:'], fontSize: 8.5 },
          { ...ibox(), width: '*', margin: [4, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 2, 0, 2],
      },

      // ─ Hospital auth ─
      {
        columns: [
          {
            width: '*',
            text: [
              'En caso de emergencia autorizo a que mi hijo sea llevado al ',
              { text: 'hospital', bold: true }, ' o ', { text: 'clínica', bold: true },
              ' que por criterio de los Scouters y/o dirigentes encargados sea el más conveniente:',
            ],
            fontSize: 8.5,
          },
          { width: 'auto', text: 'SI:', fontSize: 8.5 },
          { ...cbox(), margin: [3, 0, 6, 0] },
          { width: 'auto', text: 'NO:', fontSize: 8.5 },
          { ...cbox(), margin: [3, 0, 0, 0] },
        ],
        columnGap: 3, margin: [0, 2, 0, 2],
      },

      // ─ Hospital / clínica ─
      {
        columns: [
          { width: 'auto', text: ['Solicito acudan al hospital, clínica o ', { text: 'centro de Salud', bold: true }, ':'], fontSize: 8.5 },
          { ...ibox(), width: '*', margin: [4, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 2, 0, 2],
      },

      // ─ IMSS ─
      {
        columns: [
          { width: 'auto', text: ['No. ', { text: 'IMSS', bold: true }, ':'], fontSize: 8.5 },
          { ...ibox(), width: 130, margin: [4, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 2, 0, 2],
      },

      // ─ ISSSTE ─
      {
        columns: [
          { width: 'auto', text: ['No.  ', { text: 'ISSSTE', bold: true }, ':'], fontSize: 8.5 },
          { ...ibox(), width: 160, margin: [4, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 2, 0, 2],
      },

      // ─ Seguro Popular ─
      {
        columns: [
          { width: 'auto', text: ['No. POLIZA SEGURO ', { text: 'POPULAR', bold: true }, ':'], fontSize: 8.5 },
          { ...ibox(), width: 160, margin: [4, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 2, 0, 6],
      },

      divider(),

      // ─ Nombre del Joven ─
      {
        columns: [
          { width: 'auto', text: [{ text: 'Nombre del Joven:', bold: true }], fontSize: 9 },
          { ...ibox(nombreJoven), width: '*', margin: [4, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 4, 0, 4],
      },

      // ─ CUM ─
      {
        columns: [
          { width: 'auto', text: [{ text: 'CUM:', bold: true }], fontSize: 9 },
          { ...this.buildCumBoxes(cum), margin: [6, 0, 0, 0] },
        ],
        columnGap: 0, margin: [0, 2, 0, 4],
      },

      divider(),

      // ─ Contactos Scouter ─
      {
        text: 'DATOS DE CONTACTO DEL SCOUTER',
        fontSize: 9, bold: true, color: NAVY, alignment: 'center',
        margin: [0, 4, 0, 6],
      },
      ...contactos.map(c => ({
        columns: [
          { width: 10, text: '•', fontSize: 9, color: NAVY },
          {
            width: '*',
            text: [
              `${c.nombre || ''}  `,
              { text: `[${c.telefono || '—'}]`, bold: true },
              `  (${c.cargo || '—'})`,
            ],
            fontSize: 8.5,
          },
        ],
        margin: [14, 1, 0, 3],
      })),

      thick(),

      // ─ Firma padre ─
      {
        text: 'Nombre del Padre o Tutor',
        fontSize: 9, bold: true, alignment: 'center',
        margin: [0, 4, 0, 0],
      },
    ];
  }

  private buildCumBoxes(cum: string): any {
    const len = 14;
    return {
      table: {
        widths: Array(len).fill(17),
        body: [Array.from({ length: len }, (_, i) => ({
          text: cum[i] || ' ',
          fontSize: 8, fillColor: '#E5E7EB', alignment: 'center', margin: [0, 1, 0, 1],
        }))],
      },
      layout: {
        hLineColor: () => '#9CA3AF',
        vLineColor: () => '#9CA3AF',
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
      },
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async save(dto: AvisoSalidaDto, userId: number, userName: string): Promise<AvisoSalida> {
    const entity = this.repo.create({
      tipo: dto.tipo || 'Otro',
      nombre: dto.nombre || 'Sin nombre',
      fechaSalida: dto.salida?.fecha ? dto.salida.fecha.slice(0, 10) : null,
      creadoPorId: userId,
      creadoPorNombre: userName,
      data: dto,
    });
    return this.repo.save(entity);
  }

  findAll(): Promise<AvisoSalida[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<AvisoSalida> {
    const aviso = await this.repo.findOne({ where: { id } });
    if (!aviso) throw new NotFoundException('Aviso no encontrado');
    return aviso;
  }

  async update(id: number, dto: AvisoSalidaDto): Promise<AvisoSalida> {
    const aviso = await this.findOne(id);
    aviso.tipo        = dto.tipo        || aviso.tipo;
    aviso.nombre      = dto.nombre      || aviso.nombre;
    aviso.fechaSalida = dto.salida?.fecha ? dto.salida.fecha.slice(0, 10) : aviso.fechaSalida;
    aviso.data        = dto;
    return this.repo.save(aviso);
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
