import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { CicloPrograma } from './entities/ciclo-programa.entity';
import { ActividadCiclo } from './entities/actividad-ciclo.entity';
import { CrearCicloDto } from './dto/ciclo-programa.dto';
import { SeccionesService } from '../secciones/secciones.service';
import { IdentidadPdf, tono } from '../secciones/identidad-pdf';

const PdfPrinter = require('pdfmake/js/Printer').default;
const vfsFonts    = require('pdfmake/build/vfs_fonts');

// ── Colores ────────────────────────────────────────────────────────────────────
const C = {
  purple:      '#5B21B6',
  purpleLight: '#EDE9FE',
  purpleMid:   '#7C3AED',
  gold:        '#D97706',
  goldLight:   '#FEF3C7',
  cream:       '#F9F5F0',
  border:      '#D8D0F0',
  gray:        '#6B7280',
  grayLight:   '#F3F4F6',
  white:       '#FFFFFF',
  text:        '#1E1E2E',
  textLight:   '#374151',
};

/**
 * Los morados y el dorado toman los colores de la sección del ciclo; se fijan al
 * inicio de cada documento (la construcción es síncrona tras la última espera).
 */
function aplicarPaleta(id: IdentidadPdf) {
  C.purple = id.principal;
  C.purpleMid = id.principalMedio;
  C.purpleLight = id.principalClaro;
  C.border = tono(id.principal, 0.8);
  C.gold = id.acentoOscuro;
  C.goldLight = id.acentoClaro;
}

// Color por eje temático
const EJE_COLORS: Record<string, { bg: string; text: string }> = {
  'Habilidades para la Vida':         { bg: '#DBEAFE', text: '#1E40AF' },
  'Salud y Bienestar':                { bg: '#D1FAE5', text: '#065F46' },
  'Medio Ambiente y Sustentabilidad': { bg: '#D1FAE5', text: '#166534' },
  'Paz y Acción Comunitaria':         { bg: '#FEF3C7', text: '#92400E' },
};

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function fmtSabado(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = MESES[d.getMonth() + 1];
  const year = d.getFullYear();
  return `Sáb ${dia} ${mes} ${year}`;
}

@Injectable()
export class CiclosProgramaService {
  private printer:   any;
  private logoGrupo: string | null = null;

  constructor(
    @InjectRepository(CicloPrograma)
    private cicloRepo: Repository<CicloPrograma>,
    @InjectRepository(ActividadCiclo)
    private actividadRepo: Repository<ActividadCiclo>,
    private readonly secciones: SeccionesService,
  ) {
    const assetsDir = path.join(__dirname, '../../public/assets');
    const grupoPath = path.join(assetsDir, 'logo_Grupo.png');
    if (fs.existsSync(grupoPath)) this.logoGrupo = `data:image/png;base64,${fs.readFileSync(grupoPath).toString('base64')}`;

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

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async create(dto: CrearCicloDto, userId: number): Promise<CicloPrograma> {
    const ciclo = this.cicloRepo.create({
      nombre:      dto.nombre,
      mesInicio:   dto.mesInicio,
      anio:        dto.anio,
      tipo:        dto.tipo,
      seccion:     dto.seccion,
      creadoPorId: userId,
    });
    const saved = await this.cicloRepo.save(ciclo);

    const actividades = dto.actividades.map((a) =>
      this.actividadRepo.create({
        cicloId:     saved.id,
        fechaSabado: a.fechaSabado,
        nombre:      a.nombre,
        ejeTematico: a.ejeTematico,
        descripcion: a.descripcion,
        orden:       a.orden,
      }),
    );
    await this.actividadRepo.save(actividades);

    return this.findOne(saved.id);
  }

  /** `seccion` null = todas (administrador y roles de grupo) */
  findAll(seccion: string | null): Promise<CicloPrograma[]> {
    return this.cicloRepo.find({
      where: seccion ? { seccion } : {},
      relations: ['creadoPor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<CicloPrograma> {
    const ciclo = await this.cicloRepo.findOne({
      where: { id },
      relations: ['creadoPor', 'actividades'],
    });
    if (!ciclo) throw new NotFoundException(`Ciclo #${id} no encontrado`);
    ciclo.actividades.sort((a, b) => a.orden - b.orden);
    return ciclo;
  }

  async update(id: number, dto: CrearCicloDto): Promise<CicloPrograma> {
    const ciclo = await this.findOne(id);
    Object.assign(ciclo, {
      nombre:    dto.nombre,
      mesInicio: dto.mesInicio,
      anio:      dto.anio,
      tipo:      dto.tipo,
      // la sección del ciclo no cambia al editarlo
    });
    await this.cicloRepo.save(ciclo);

    // Reemplazar actividades
    await this.actividadRepo.delete({ cicloId: id });
    const actividades = dto.actividades.map((a) =>
      this.actividadRepo.create({
        cicloId:     id,
        fechaSabado: a.fechaSabado,
        nombre:      a.nombre,
        ejeTematico: a.ejeTematico,
        descripcion: a.descripcion,
        orden:       a.orden,
      }),
    );
    await this.actividadRepo.save(actividades);

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.cicloRepo.delete(id);
  }

  /** Devuelve las actividades del ciclo de programa que caen en el mes/año indicado */
  async findActividadesMes(seccion: string, anio: number, mes: number): Promise<ActividadCiclo[]> {
    const ciclos = await this.cicloRepo.find({
      where: { seccion },
      relations: ['actividades'],
    });
    const prefix = `${anio}-${String(mes).padStart(2, '0')}`;
    const resultado: ActividadCiclo[] = [];
    for (const ciclo of ciclos) {
      for (const act of ciclo.actividades) {
        if (act.fechaSabado.startsWith(prefix)) {
          resultado.push(act);
        }
      }
    }
    return resultado.sort((a, b) => a.fechaSabado.localeCompare(b.fechaSabado));
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  async generatePdf(ciclo: CicloPrograma, autorNombre?: string): Promise<Buffer> {
    const identidad = await this.secciones.identidadPdf(ciclo.seccion);
    aplicarPaleta(identidad);
    const logoDerecha = identidad.logoDerecha;
    const periodLabel = this.periodoLabel(ciclo);

    const tipoLabel = ciclo.tipo === 'trimestral' ? 'Trimestral (3 meses)' : 'Cuatrimestral (4 meses)';
    const seccionLabel = identidad.config ? identidad.nombre : this.seccionLabel(ciclo.seccion);
    const autor = autorNombre || 'Sin especificar';

    const tablaActividades = this.buildTablaActividades(ciclo);

    const dd: any = {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [30, 30, 30, 30],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: C.text },
      images: {
        ...(this.logoGrupo ? { logoGrupo: this.logoGrupo } : {}),
        ...(logoDerecha ? { logoDerecha } : {}),
      },
      content: [
        // ── Encabezado ──────────────────────────────────────────────────────
        {
          columns: [
            // Logo Grupo (izquierda)
            this.logoGrupo
              ? { image: 'logoGrupo', width: 55, alignment: 'center', margin: [0, 0, 10, 0] }
              : { width: 55, text: '' },
            // Título central
            {
              width: '*',
              stack: [
                { text: 'CICLO DE PROGRAMA', fontSize: 20, bold: true, color: C.purple },
                { text: ciclo.nombre,  fontSize: 14, bold: true, color: C.text, margin: [0, 2, 0, 0] },
                { text: seccionLabel, fontSize: 11, color: C.gray,  margin: [0, 2, 0, 0] },
              ],
            },
            // Metadata (derecha)
            {
              width: 'auto',
              stack: [
                { columns: [{ text: 'Período:', bold: true, fontSize: 9, color: C.gray, width: 65 }, { text: periodLabel, fontSize: 9, color: C.text }], margin: [0, 0, 0, 3] },
                { columns: [{ text: 'Tipo:', bold: true, fontSize: 9, color: C.gray, width: 65 }, { text: tipoLabel, fontSize: 9, color: C.text }], margin: [0, 0, 0, 3] },
                { columns: [{ text: 'Creado por:', bold: true, fontSize: 9, color: C.gray, width: 65 }, { text: autor, fontSize: 9, color: C.text }], margin: [0, 0, 0, 3] },
                { columns: [{ text: 'Fines de semana:', bold: true, fontSize: 9, color: C.gray, width: 65 }, { text: ciclo.actividades.length.toString(), fontSize: 9, color: C.text }] },
              ],
              alignment: 'right',
              margin: [10, 0, 10, 0],
            },
            // Logo CC (derecha)
            logoDerecha
              ? identidad.logoDerechaHorizontal
                ? { image: 'logoDerecha', width: 110, alignment: 'center', margin: [10, 0, 0, 0] }
                : { image: 'logoDerecha', width: 50, height: 50, alignment: 'center', margin: [10, 0, 0, 0] }
              : { width: 55, text: '' },
          ],
          margin: [0, 0, 0, 8],
        },
        // Línea divisora
        {
          canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 2, lineColor: C.purple },
          ],
          margin: [0, 0, 0, 10],
        },
        // ── Tabla de actividades ────────────────────────────────────────────
        tablaActividades,
        ...this.buildLeyendaPie(),
      ],
      styles: {
        tableHeader: {
          bold: true,
          fontSize: 9,
          color: C.white,
          fillColor: C.purple,
          margin: [4, 5, 4, 5],
        },
      },
    };

    return this.renderPdf(dd);
  }

  private periodoLabel(ciclo: CicloPrograma): string {
    const dur = ciclo.tipo === 'trimestral' ? 3 : 4;
    const mesFin = ((ciclo.mesInicio - 1 + dur - 1) % 12) + 1;
    const anioFin = ciclo.mesInicio + dur - 1 > 12 ? ciclo.anio + 1 : ciclo.anio;
    return mesFin < ciclo.mesInicio
      ? `${MESES[ciclo.mesInicio]} ${ciclo.anio} – ${MESES[mesFin]} ${anioFin}`
      : `${MESES[ciclo.mesInicio]} – ${MESES[mesFin]} ${ciclo.anio}`;
  }

  private buildTablaActividades(ciclo: CicloPrograma): any {
    const tableBody: any[][] = [
      // Header row
      [
        { text: '#',            style: 'tableHeader', alignment: 'center' },
        { text: 'Fin de Semana', style: 'tableHeader' },
        { text: 'Actividad',    style: 'tableHeader' },
        { text: 'Eje Temático', style: 'tableHeader' },
        { text: 'Notas',        style: 'tableHeader' },
      ],
    ];

    ciclo.actividades.forEach((act, idx) => {
      const ejeColor = EJE_COLORS[act.ejeTematico] ?? { bg: C.grayLight, text: C.gray };
      const rowBg = idx % 2 === 0 ? C.white : C.cream;
      tableBody.push([
        {
          text: (idx + 1).toString(),
          alignment: 'center',
          fontSize: 9,
          color: C.gray,
          fillColor: rowBg,
          margin: [0, 4, 0, 4],
        },
        {
          text: fmtSabado(act.fechaSabado),
          fontSize: 9,
          bold: true,
          color: C.text,
          fillColor: rowBg,
          margin: [4, 4, 4, 4],
        },
        {
          text: act.nombre || '—',
          fontSize: 9,
          color: C.text,
          fillColor: rowBg,
          margin: [4, 4, 4, 4],
        },
        {
          text: act.ejeTematico || '—',
          fontSize: 8,
          bold: true,
          color: ejeColor.text,
          fillColor: ejeColor.bg,
          margin: [4, 4, 4, 4],
        },
        {
          text: act.descripcion || '',
          fontSize: 8,
          color: C.gray,
          fillColor: rowBg,
          margin: [4, 4, 4, 4],
          italics: true,
        },
      ]);
    });

    return {
      table: {
        headerRows: 1,
        widths: [25, 115, '*', 130, 120],
        body: tableBody,
      },
      layout: {
        hLineWidth: (i: number) => (i === 0 || i === 1) ? 1.5 : 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => C.border,
        vLineColor: () => C.border,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
    };
  }

  private buildLeyendaPie(): any[] {
    return [
      { text: 'Ejes Temáticos', fontSize: 9, bold: true, color: C.gray, margin: [0, 12, 0, 4] },
      {
        columns: Object.entries(EJE_COLORS).map(([eje, col]) => ({
          text: `■ ${eje}`,
          fontSize: 7,
          bold: true,
          color: col.text,
          margin: [0, 0, 8, 0],
        })),
        columnGap: 4,
      },
      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 0.5, lineColor: C.border },
        ],
        margin: [0, 10, 0, 4],
      },
      {
        columns: [
          { text: 'Scouts México — Nuevo Programa', fontSize: 7, color: C.gray },
          {
            text: `Generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
            fontSize: 7,
            color: C.gray,
            alignment: 'right',
          },
        ],
      },
    ];
  }

  private renderPdf(dd: any): Promise<Buffer> {
    return this.printer.createPdfKitDocument(dd).then((doc: any) =>
      new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
      }),
    );
  }

  /** Ciclos de una sección en un año, ordenados por mes de inicio */
  async findByAnioSeccion(anio: number, seccion: string): Promise<CicloPrograma[]> {
    const ciclos = await this.cicloRepo.find({
      where: { anio, seccion },
      order: { mesInicio: 'ASC' },
    });
    for (const c of ciclos) {
      c.actividades.sort((a, b) => a.fechaSabado.localeCompare(b.fechaSabado));
    }
    return ciclos;
  }

  async generatePdfAnual(ciclos: CicloPrograma[], anio: number, seccion: string, autorNombre?: string): Promise<Buffer> {
    const identidad = await this.secciones.identidadPdf(seccion);
    aplicarPaleta(identidad);
    const logoDerecha = identidad.logoDerecha;
    const totalFines = ciclos.reduce((n, c) => n + c.actividades.length, 0);
    const autor = autorNombre || 'Sin especificar';

    const encabezado = {
      columns: [
        this.logoGrupo
          ? { image: 'logoGrupo', width: 55, alignment: 'center', margin: [0, 0, 10, 0] }
          : { width: 55, text: '' },
        {
          width: '*',
          stack: [
            { text: `CICLO DE PROGRAMA ANUAL ${anio}`, fontSize: 20, bold: true, color: C.purple },
            { text: identidad.config ? identidad.nombre : this.seccionLabel(seccion), fontSize: 14, bold: true, color: C.text, margin: [0, 2, 0, 0] },
          ],
        },
        {
          width: 'auto',
          stack: [
            { columns: [{ text: 'Ciclos:', bold: true, fontSize: 9, color: C.gray, width: 85 }, { text: ciclos.length.toString(), fontSize: 9, color: C.text }], margin: [0, 0, 0, 3] },
            { columns: [{ text: 'Fines de semana:', bold: true, fontSize: 9, color: C.gray, width: 85 }, { text: totalFines.toString(), fontSize: 9, color: C.text }], margin: [0, 0, 0, 3] },
            { columns: [{ text: 'Generado por:', bold: true, fontSize: 9, color: C.gray, width: 85 }, { text: autor, fontSize: 9, color: C.text }] },
          ],
          alignment: 'right',
          margin: [10, 0, 10, 0],
        },
        logoDerecha
          ? identidad.logoDerechaHorizontal
            ? { image: 'logoDerecha', width: 110, alignment: 'center', margin: [10, 0, 0, 0] }
            : { image: 'logoDerecha', width: 50, height: 50, alignment: 'center', margin: [10, 0, 0, 0] }
          : { width: 55, text: '' },
      ],
      margin: [0, 0, 0, 8],
    };
    const linea = {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 2, lineColor: C.purple }],
      margin: [0, 0, 0, 10],
    };

    const secciones: any[] = [];
    ciclos.forEach((ciclo, i) => {
      const tipoLabel = ciclo.tipo === 'trimestral' ? 'Trimestral (3 meses)' : 'Cuatrimestral (4 meses)';
      secciones.push(
        {
          text: ciclo.nombre,
          fontSize: 14, bold: true, color: C.purple,
          margin: [0, i === 0 ? 0 : 0, 0, 2],
          ...(i > 0 ? { pageBreak: 'before' } : {}),
        },
        {
          text: `${this.periodoLabel(ciclo)} · ${tipoLabel} · ${ciclo.actividades.length} fines de semana`,
          fontSize: 9, color: C.gray, margin: [0, 0, 0, 8],
        },
        this.buildTablaActividades(ciclo),
      );
    });

    const dd: any = {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [30, 30, 30, 30],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: C.text },
      images: {
        ...(this.logoGrupo ? { logoGrupo: this.logoGrupo } : {}),
        ...(logoDerecha ? { logoDerecha } : {}),
      },
      content: [encabezado, linea, ...secciones, ...this.buildLeyendaPie()],
      styles: {
        tableHeader: { bold: true, fontSize: 9, color: C.white, fillColor: C.purple, margin: [4, 5, 4, 5] },
      },
    };
    return this.renderPdf(dd);
  }

  private seccionLabel(seccion: string): string {
    const map: Record<string, string> = {
      manada:    'Manada de Lobatos',
      tropa:     'Tropa de Scouts',
      comunidad: 'Comunidad de Caminantes',
      clan:      'Clan de Rovers',
      grupo:     'Grupo Scout',
    };
    return map[seccion] ?? seccion;
  }
}
