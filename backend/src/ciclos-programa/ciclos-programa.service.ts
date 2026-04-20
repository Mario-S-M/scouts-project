import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { CicloPrograma } from './entities/ciclo-programa.entity';
import { ActividadCiclo } from './entities/actividad-ciclo.entity';
import { CrearCicloDto } from './dto/ciclo-programa.dto';

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
  private logoCC:    string | null = null;

  constructor(
    @InjectRepository(CicloPrograma)
    private cicloRepo: Repository<CicloPrograma>,
    @InjectRepository(ActividadCiclo)
    private actividadRepo: Repository<ActividadCiclo>,
  ) {
    const assetsDir = path.join(__dirname, '../../public/assets');
    const grupoPath = path.join(assetsDir, 'logo_Grupo.png');
    const ccPath    = path.join(assetsDir, 'logo_CC.png');
    if (fs.existsSync(grupoPath)) this.logoGrupo = `data:image/png;base64,${fs.readFileSync(grupoPath).toString('base64')}`;
    if (fs.existsSync(ccPath))    this.logoCC    = `data:image/png;base64,${fs.readFileSync(ccPath).toString('base64')}`;

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

  findAll(): Promise<CicloPrograma[]> {
    return this.cicloRepo.find({
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
      seccion:   dto.seccion,
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
    const mesesDuracion = ciclo.tipo === 'trimestral' ? 3 : 4;
    const mesFin = ((ciclo.mesInicio - 1 + mesesDuracion) % 12) + 1;
    const anioFin = ciclo.mesInicio + mesesDuracion - 1 > 12
      ? ciclo.anio + 1
      : ciclo.anio;

    const periodLabel =
      mesFin < ciclo.mesInicio
        ? `${MESES[ciclo.mesInicio]} ${ciclo.anio} – ${MESES[mesFin]} ${anioFin}`
        : `${MESES[ciclo.mesInicio]} – ${MESES[mesFin]} ${ciclo.anio}`;

    const tipoLabel = ciclo.tipo === 'trimestral' ? 'Trimestral (3 meses)' : 'Cuatrimestral (4 meses)';
    const seccionLabel = this.seccionLabel(ciclo.seccion);
    const autor = autorNombre || 'Sin especificar';

    // Filas de la tabla
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

    const dd: any = {
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [30, 30, 30, 30],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: C.text },
      images: {
        ...(this.logoGrupo ? { logoGrupo: this.logoGrupo } : {}),
        ...(this.logoCC    ? { logoCC:    this.logoCC    } : {}),
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
            this.logoCC
              ? { image: 'logoCC', width: 55, alignment: 'center', margin: [10, 0, 0, 0] }
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
        {
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
        },
        // ── Leyenda de ejes ─────────────────────────────────────────────────
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
        // ── Pie ─────────────────────────────────────────────────────────────
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

    const doc = await this.printer.createPdfKitDocument(dd);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
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
