import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../users/entities/user.entity';
import { InformeMensual } from './entities/informe-mensual.entity';
import { AltaBajaInforme } from './entities/alta-baja-informe.entity';
import { AsistenciaActividad } from './entities/asistencia-actividad.entity';
import { ActividadPendiente } from './entities/actividad-pendiente.entity';
import { MovimientoFinanciero } from './entities/movimiento-financiero.entity';
import { InventarioItem } from './entities/inventario-item.entity';
import { ProgresionInforme } from './entities/progresion-informe.entity';
import { CrearInformeDto, InventarioItemCrudDto } from './dto/informe-mensual.dto';
import { EspecialidadProgreso } from '../progreso/entities/especialidad-progreso.entity';
import { SolicitudInsignias } from '../insignias/entities/solicitud-insignias.entity';

import { PDFDocument } from 'pdf-lib';
const PdfPrinter = require('pdfmake/js/Printer').default;
const vfsFonts    = require('pdfmake/build/vfs_fonts');

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/** Parsea tanto 'YYYY-MM-DD' como 'DD/MM/YYYY' */
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // Formato DD/MM/YYYY (PrimeNG p-calendar con dateFormat="dd/mm/yy")
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d, 12);
  }
  // Formato YYYY-MM-DD (ISO)
  const d = new Date(s + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/** Convierte cualquier formato de fecha a YYYY-MM-DD para PostgreSQL (null si vacío) */
function toIso(s: string | null | undefined): string | null {
  const d = parseDate(s);
  if (!d) return null;
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmt(s: string | null | undefined): string {
  const d = parseDate(s);
  if (!d) return '—';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDia(s: string | null | undefined): string {
  const d = parseDate(s);
  return d ? d.getDate().toString() : '—';
}

function peso(n: number | string): string {
  return `$${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// ── Paleta institucional (tomada del emblema de la Comunidad: azul + oro) ────
const AZUL     = '#14265C';  // azul marino del bordado del Grupo 7
const AZUL_MED = '#2C4A9A';  // azul del emblema (rosa de los vientos)
const AZUL_CLR = '#EDF1FA';  // fondo de fila alterna
const ORO      = '#EFC02F';  // amarillo del sol del emblema
const ORO_OSC  = '#B8891A';  // oro oscuro para texto sobre claro
const ORO_CLR  = '#FDF7E6';  // fondo dorado tenue
const BK = '#1A1A1A';
const GR = '#D9D9D9';
const WH = '#FFFFFF';
const LG = '#F2F2F2';
const TX_SUAVE = '#5A6478';  // texto secundario
const LINEA    = '#C7D0E4';  // líneas de tabla suaves
const VERDE    = '#1E7A46';  // ingresos
const ROJO     = '#B3261E';  // egresos

@Injectable()
export class InformesService {
  private printer:   any;
  private logoGrupo: string | null = null;
  private logoCC:    string | null = null;

  constructor(
    @InjectRepository(InformeMensual)
    private informeRepo: Repository<InformeMensual>,
    @InjectRepository(AltaBajaInforme)
    private altaBajaRepo: Repository<AltaBajaInforme>,
    @InjectRepository(AsistenciaActividad)
    private asistenciaRepo: Repository<AsistenciaActividad>,
    @InjectRepository(ActividadPendiente)
    private pendienteRepo: Repository<ActividadPendiente>,
    @InjectRepository(MovimientoFinanciero)
    private movimientoRepo: Repository<MovimientoFinanciero>,
    @InjectRepository(InventarioItem)
    private inventarioRepo: Repository<InventarioItem>,
    @InjectRepository(ProgresionInforme)
    private progresionRepo: Repository<ProgresionInforme>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(EspecialidadProgreso)
    private especialidadRepo: Repository<EspecialidadProgreso>,
    @InjectRepository(SolicitudInsignias)
    private solicitudRepo: Repository<SolicitudInsignias>,
  ) {
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
    const ccPath    = pick('logo_CC_pdf.png',    'logo_CC.png');
    if (grupoPath) this.logoGrupo = `data:image/png;base64,${fs.readFileSync(grupoPath).toString('base64')}`;
    if (ccPath)    this.logoCC    = `data:image/png;base64,${fs.readFileSync(ccPath).toString('base64')}`;
    if (!grupoPath || !ccPath) {
      // eslint-disable-next-line no-console
      console.warn(`[InformesService] Logos no encontrados en ${assetsDir}; el PDF usará el escudo de respaldo.`);
    }
  }

  // ── CRUD Informe ───────────────────────────────────────────────────────────
  async create(dto: CrearInformeDto, userId: number): Promise<InformeMensual> {
    const informe = this.informeRepo.create({
      mes: dto.mes, anio: dto.anio, seccion: dto.seccion,
      totalRegistrados: dto.totalRegistrados, totalEnlace: dto.totalEnlace,
      totalCaptacion: dto.totalCaptacion, totalNoRegistrados: dto.totalNoRegistrados,
      saldoInicial: dto.saldoInicial,
      observacionesGenerales: dto.observacionesGenerales,
      creadoPorId: userId,
    });
    const saved = await this.informeRepo.save(informe);
    await this.saveRelations(saved.id, dto);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: CrearInformeDto): Promise<InformeMensual> {
    const informe = await this.findOne(id);
    Object.assign(informe, {
      mes: dto.mes, anio: dto.anio, seccion: dto.seccion,
      totalRegistrados: dto.totalRegistrados, totalEnlace: dto.totalEnlace,
      totalCaptacion: dto.totalCaptacion, totalNoRegistrados: dto.totalNoRegistrados,
      saldoInicial: dto.saldoInicial,
      observacionesGenerales: dto.observacionesGenerales,
    });
    await this.informeRepo.save(informe);

    // Borrar y recrear relaciones
    await this.altaBajaRepo.delete({ informeId: id });
    await this.asistenciaRepo.delete({ informeId: id });
    await this.pendienteRepo.delete({ informeId: id });
    await this.movimientoRepo.delete({ informeId: id });
    await this.progresionRepo.delete({ informeId: id });
    await this.saveRelations(id, dto);
    return this.findOne(id);
  }

  private async saveRelations(id: number, dto: CrearInformeDto) {
    if (dto.altasBajas?.length)
      await this.altaBajaRepo.save(dto.altasBajas.map(a => this.altaBajaRepo.create({ ...a, informeId: id })));
    if (dto.actividades?.length)
      await this.asistenciaRepo.save(dto.actividades.map(a =>
        this.asistenciaRepo.create({ ...a, fecha: toIso(a.fecha), informeId: id })));
    if (dto.actividadesPendientes?.length)
      await this.pendienteRepo.save(dto.actividadesPendientes.map(a =>
        this.pendienteRepo.create({ ...a, informeId: id })));
    if (dto.movimientos?.length)
      await this.movimientoRepo.save(dto.movimientos.map(m =>
        this.movimientoRepo.create({ ...m, fecha: toIso(m.fecha), informeId: id })));
    if (dto.progresiones?.length)
      await this.progresionRepo.save(dto.progresiones.map(p =>
        this.progresionRepo.create({ ...p, fecha: toIso(p.fecha), informeId: id })));
  }

  findAll(): Promise<InformeMensual[]> {
    return this.informeRepo.find({ relations: ['creadoPor'], order: { anio: 'DESC', mes: 'DESC' } });
  }

  /** Último informe guardado de una sección, con saldoActual calculado */
  async findUltimo(seccion: string): Promise<(InformeMensual & { saldoActual: number }) | null> {
    const informe = await this.informeRepo.findOne({
      where: { seccion },
      order: { anio: 'DESC', mes: 'DESC' },
      relations: ['creadoPor', 'altasBajas', 'actividades', 'actividadesPendientes', 'movimientos', 'progresiones'],
    });
    if (!informe) return null;
    informe.actividades.sort((a, b) => a.orden - b.orden);
    informe.altasBajas.sort((a, b) => a.orden - b.orden);
    informe.actividadesPendientes.sort((a, b) => a.orden - b.orden);
    informe.movimientos.sort((a, b) => a.orden - b.orden);
    informe.progresiones.sort((a, b) => a.orden - b.orden);
    const ingresos = informe.movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.cantidad), 0);
    const egresos  = informe.movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.cantidad), 0);
    const saldoActual = Number(informe.saldoInicial) + ingresos - egresos;
    return { ...informe, saldoActual };
  }

  async findOne(id: number): Promise<InformeMensual> {
    const i = await this.informeRepo.findOne({
      where: { id },
      relations: ['creadoPor','altasBajas','actividades','actividadesPendientes','movimientos','progresiones'],
    });
    if (!i) throw new NotFoundException(`Informe #${id} no encontrado`);
    i.actividades.sort((a,b) => a.orden - b.orden);
    i.altasBajas.sort((a,b) => a.orden - b.orden);
    i.actividadesPendientes.sort((a,b) => a.orden - b.orden);
    i.movimientos.sort((a,b) => a.orden - b.orden);
    i.progresiones.sort((a,b) => a.orden - b.orden);
    return i;
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.informeRepo.delete(id);
  }

  // ── Actualizaciones parciales por sección ──────────────────────────────────
  async updateConfig(id: number, data: { mes: number; anio: number; saldoInicial: number; observacionesGenerales?: string }): Promise<void> {
    await this.informeRepo.update(id, {
      mes: data.mes, anio: data.anio,
      saldoInicial: data.saldoInicial,
      observacionesGenerales: data.observacionesGenerales,
    });
  }

  async updateMembresia(id: number, data: { totalRegistrados: number; totalEnlace: number; totalCaptacion: number; totalNoRegistrados: number; altasBajas: any[] }): Promise<void> {
    await this.informeRepo.update(id, {
      totalRegistrados:  data.totalRegistrados,
      totalEnlace:       data.totalEnlace,
      totalCaptacion:    data.totalCaptacion,
      totalNoRegistrados:data.totalNoRegistrados,
    });
    await this.altaBajaRepo.delete({ informeId: id });
    if (data.altasBajas?.length)
      await this.altaBajaRepo.save(data.altasBajas.map((a: any, i: number) => this.altaBajaRepo.create({ ...a, informeId: id, orden: i })) as any);
  }

  async updateActividades(id: number, data: { actividades: any[]; actividadesPendientes: any[] }): Promise<void> {
    await this.asistenciaRepo.delete({ informeId: id });
    await this.pendienteRepo.delete({ informeId: id });
    if (data.actividades?.length)
      await this.asistenciaRepo.save(data.actividades.map((a: any, i: number) =>
        this.asistenciaRepo.create({ ...a, fecha: toIso(a.fecha), informeId: id, orden: i })) as any);
    if (data.actividadesPendientes?.length)
      await this.pendienteRepo.save(data.actividadesPendientes.map((a: any, i: number) =>
        this.pendienteRepo.create({ ...a, informeId: id, orden: i })) as any);
  }

  async updateFinanciero(id: number, data: { saldoInicial: number; movimientos: any[] }): Promise<void> {
    await this.informeRepo.update(id, { saldoInicial: data.saldoInicial });
    await this.movimientoRepo.delete({ informeId: id });
    if (data.movimientos?.length)
      await this.movimientoRepo.save(data.movimientos.map((m: any, i: number) =>
        this.movimientoRepo.create({ ...m, fecha: toIso(m.fecha), informeId: id, orden: i })) as any);
  }

  async updateProgresion(id: number, data: { progresiones: any[]; observacionesGenerales?: string }): Promise<void> {
    await this.informeRepo.update(id, { observacionesGenerales: data.observacionesGenerales });
    await this.progresionRepo.delete({ informeId: id });
    if (data.progresiones?.length)
      await this.progresionRepo.save(data.progresiones.map((p: any, i: number) =>
        this.progresionRepo.create({ ...p, fecha: toIso(p.fecha), informeId: id, orden: i })) as any);
  }

  /**
   * Agrega a Progresión las solicitudes de insignias de la sección en el mes del
   * informe. Una fila por línea de solicitud; no duplica (descripción + nombre).
   */
  async importarSolicitudesInsignias(id: number): Promise<{ agregadas: number; informe: InformeMensual }> {
    const informe = await this.findOne(id);
    const desde = `${informe.anio}-${String(informe.mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(informe.anio, informe.mes, 0).getDate();
    const hasta = `${informe.anio}-${String(informe.mes).padStart(2, '0')}-${ultimoDia}`;

    const solicitudes = await this.solicitudRepo.find({
      where: { seccion: informe.seccion, fecha: Between(desde, hasta) as any },
      relations: ['caminante', 'lineas'],
      order: { fecha: 'ASC', id: 'ASC' },
    });

    const clave = (descripcion: string, nombre: string) =>
      `${descripcion.trim().toLowerCase()}|${nombre.trim().toLowerCase()}`;
    const existentes = new Set(informe.progresiones.map(p => clave(p.descripcion, p.nombre)));
    let orden = informe.progresiones.length;
    const nuevas: ProgresionInforme[] = [];

    for (const s of solicitudes) {
      const nombre = [s.caminante?.nombre, s.caminante?.apellidos].filter(Boolean).join(' ');
      for (const l of s.lineas) {
        const descripcion = l.catalogoItem?.nombre;
        if (!descripcion || existentes.has(clave(descripcion, nombre))) continue;
        existentes.add(clave(descripcion, nombre));
        nuevas.push(this.progresionRepo.create({
          informeId: id, descripcion, nombre,
          fecha: s.fecha instanceof Date ? s.fecha.toISOString().slice(0, 10) : toIso(String(s.fecha)),
          orden: orden++,
        } as any) as unknown as ProgresionInforme);
      }
    }

    if (nuevas.length) await this.progresionRepo.save(nuevas);
    return { agregadas: nuevas.length, informe: await this.findOne(id) };
  }

  // ── Catálogo de progresión (especialidades disponibles) ───────────────────
  async getEspecialidadesCatalogo(): Promise<{ ejeTematico: string; nombre: string }[]> {
    const rows = await this.especialidadRepo
      .createQueryBuilder('e')
      .select(['e.senderoArea AS "ejeTematico"', 'e.nombre AS nombre'])
      .distinct(true)
      .orderBy('"ejeTematico"', 'ASC')
      .addOrderBy('nombre', 'ASC')
      .getRawMany();
    return rows;
  }

  // ── CRUD Inventario ────────────────────────────────────────────────────────
  getInventario(seccion: string): Promise<InventarioItem[]> {
    return this.inventarioRepo.find({ where: { seccion }, order: { anioCompra: 'ASC', id: 'ASC' } });
  }

  createInventarioItem(dto: InventarioItemCrudDto): Promise<InventarioItem> {
    return this.inventarioRepo.save(this.inventarioRepo.create(dto));
  }

  async updateInventarioItem(id: number, dto: InventarioItemCrudDto): Promise<InventarioItem> {
    const item = await this.inventarioRepo.findOneBy({ id });
    if (!item) throw new NotFoundException(`Item #${id} no encontrado`);
    Object.assign(item, dto);
    return this.inventarioRepo.save(item);
  }

  async removeInventarioItem(id: number): Promise<void> {
    await this.inventarioRepo.delete(id);
  }

  // ── Personas por sección ───────────────────────────────────────────────────
  async getPersonasSeccion(seccion: string): Promise<{ jefe: string; subjefe: string; jefeGrupo: string }> {
    const roleMap: Record<string, { jefe: string; subjefe: string }> = {
      manada:    { jefe: 'jefe_manada',    subjefe: 'sub_jefe_manada' },
      tropa:     { jefe: 'jefe_tropa',     subjefe: 'sub_jefe_tropa' },
      comunidad: { jefe: 'jefe_comunidad', subjefe: 'sub_jefe_comunidad' },
      clan:      { jefe: 'jefe_clan',      subjefe: 'sub_jefe_clan' },
    };
    const roles = roleMap[seccion] ?? { jefe: 'jefe_comunidad', subjefe: 'sub_jefe_comunidad' };

    const [jefeUser, subjefeUser, jefeGrupoUser] = await Promise.all([
      this.userRepo.findOne({ where: { rol: roles.jefe,     activo: true } }),
      this.userRepo.findOne({ where: { rol: roles.subjefe,  activo: true } }),
      this.userRepo.findOne({ where: { rol: 'jefe_grupo',   activo: true } }),
    ]);

    return {
      jefe:      jefeUser?.nombre      ?? 'Jefe de Sección',
      subjefe:   subjefeUser?.nombre   ?? 'Subjefe de Sección',
      jefeGrupo: jefeGrupoUser?.nombre ?? 'Jefe de Grupo',
    };
  }

  // ── PDF anual ──────────────────────────────────────────────────────────────
  /** Une en un solo PDF los informes de cada mes del año (orden enero→diciembre). */
  async generatePdfAnual(seccion: string, anio: number): Promise<Buffer> {
    const resumen = await this.informeRepo.find({
      where: { seccion, anio },
      select: ['id', 'mes'],
      order: { mes: 'ASC', id: 'ASC' },
    });
    if (!resumen.length) {
      throw new NotFoundException(`No hay informes de ${this.seccionLabel(seccion)} para ${anio}`);
    }
    const inventario = await this.getInventario(seccion);
    const personas   = await this.getPersonasSeccion(seccion);

    const unido = await PDFDocument.create();
    for (const { id } of resumen) {
      const informe = await this.findOne(id);
      const pdf     = await PDFDocument.load(await this.generatePdf(informe, inventario, personas));
      const paginas = await unido.copyPages(pdf, pdf.getPageIndices());
      paginas.forEach(p => unido.addPage(p));
    }
    return Buffer.from(await unido.save());
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  async generatePdf(
    informe: InformeMensual,
    inventario: InventarioItem[],
    personas?: { jefe: string; subjefe: string; jefeGrupo: string },
  ): Promise<Buffer> {
    const mesLabel = MESES[informe.mes];
    const seccionLabel = this.seccionLabel(informe.seccion);
    const jefeNombre    = personas?.jefe      ?? 'Jefe de Sección';
    const subjefeNombre = personas?.subjefe   ?? 'Subjefe de Sección';
    const jefeGrupoNombre = personas?.jefeGrupo ?? 'Jefe de Grupo';

    const ingresos = informe.movimientos.filter(m => m.tipo === 'ingreso');
    const egresos  = informe.movimientos.filter(m => m.tipo === 'egreso');
    const totalIngresos = ingresos.reduce((s, m) => s + Number(m.cantidad), 0);
    const totalEgresos  = egresos.reduce((s,  m) => s + Number(m.cantidad), 0);
    const saldoActual   = Number(informe.saldoInicial) + totalIngresos - totalEgresos;

    // Promedio de asistencia
    const actsCon = informe.actividades.filter(a => a.asistencia > 0);
    const promedio = actsCon.length
      ? Math.round(actsCon.reduce((s, a) => s + a.asistencia, 0) / actsCon.length)
      : 0;

    // ── helpers de tabla ──────────────────────────────────────────────────────
    /** Título de sección: barra azul con filete dorado inferior. */
    const sectionTitle = (text: string, icono = '') => ({
      table: { widths: ['*'], body: [
        [{ text: icono ? `${icono}   ${text}` : text,
           fontSize: 10, bold: true, alignment: 'left', characterSpacing: 0.6,
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

    const cell = (text: string | number, opts: any = {}) => ({
      text: text === null || text === undefined ? '' : String(text),
      fontSize: 8, alignment: 'left', margin: [4, 3.5, 4, 3.5], ...opts,
    });

    const cellC = (text: string | number, opts: any = {}) =>
      cell(text, { alignment: 'center', ...opts });

    /** Layout de tabla: sin rejilla pesada, líneas finas y filas alternas. */
    const tablaLayout = (opts: { zebra?: boolean; desde?: number } = {}) => {
      const { zebra = true, desde = 1 } = opts;
      return {
        hLineWidth: (i: number, node: any) =>
          (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
        vLineWidth: () => 0,
        hLineColor: (i: number, node: any) =>
          (i === 0 || i === 1 || i === node.table.body.length ? AZUL_MED : LINEA),
        paddingLeft:  () => 2,
        paddingRight: () => 2,
        fillColor: (rowIndex: number) =>
          (zebra && rowIndex >= desde && (rowIndex - desde) % 2 === 1 ? AZUL_CLR : null),
      };
    };

    /** Recuadro tipo "tarjeta" con cifra grande — para los indicadores de portada. */
    const tarjeta = (valor: string | number, etiqueta: string, color = AZUL) => ({
      table: { widths: ['*'], body: [[{
        stack: [
          { text: String(valor), fontSize: 20, bold: true, color, alignment: 'center', margin: [0, 6, 0, 0] },
          { text: etiqueta.toUpperCase(), fontSize: 6.5, bold: true, color: TX_SUAVE,
            alignment: 'center', characterSpacing: 0.5, margin: [0, 2, 0, 7] },
        ],
        fillColor: '#FBFCFE',
      }]] },
      layout: {
        hLineWidth: (i: number) => (i === 0 ? 2.2 : 0.6),
        vLineWidth: () => 0.6,
        hLineColor: (i: number) => (i === 0 ? color : LINEA),
        vLineColor: () => LINEA,
      },
    });

    /** Fila única centrada para tablas sin registros. */
    const filaVacia = (columnas: number, texto: string) => [
      { text: texto, colSpan: columnas, alignment: 'center', italics: true,
        fontSize: 7.5, color: TX_SUAVE, margin: [0, 9, 0, 9] },
      ...Array(columnas - 1).fill({}),
    ];

    /** Bloque de firma: rótulo, línea, nombre y cargo. */
    const firma = (nombre: string, cargo: string, rotulo: string) => ({
      width: 186,
      stack: [
        { text: rotulo, fontSize: 6.8, bold: true, color: ORO_OSC,
          characterSpacing: 1, alignment: 'center', margin: [0, 0, 0, 20] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 186, y2: 0,
                     lineWidth: 0.9, lineColor: AZUL }] },
        { text: (nombre || '').toUpperCase(), fontSize: 8, bold: true, color: AZUL,
          alignment: 'center', margin: [0, 3, 0, 0] },
        { text: cargo, fontSize: 7, alignment: 'center', color: TX_SUAVE, margin: [0, 1, 0, 0] },
        { text: 'Firma', fontSize: 6, alignment: 'center', color: '#B6BECD', margin: [0, 1, 0, 0] },
      ],
    });

    // ── Gráficas dibujadas con canvas de pdfmake ──────────────────────────────
    /** Barras verticales con eje, rejilla y etiquetas de valor. */
    const graficaBarras = (
      datos: { etiqueta: string; valor: number; color?: string }[],
      opts: { ancho?: number; alto?: number; promedio?: number | null;
              sufijo?: string; formato?: (n: number) => string } = {},
    ): any => {
      const { ancho = 500, alto = 110, promedio = null, sufijo = '', formato } = opts;
      const etiquetaValor = (n: number) => (formato ? formato(n) : `${n}${sufijo}`);
      if (!datos.length) {
        return { text: 'Sin datos suficientes para graficar.', fontSize: 7.5,
                 italics: true, color: TX_SUAVE, alignment: 'center', margin: [0, 8, 0, 8] };
      }
      const maxVal = Math.max(...datos.map(d => d.valor), promedio ?? 0, 1);
      const nb     = datos.length;
      const gap    = nb > 12 ? 3 : 8;
      const anchoB = Math.max(6, (ancho - gap * (nb + 1)) / nb);
      const c: any[] = [];

      // Rejilla horizontal (4 divisiones) — se dibuja primero para quedar detrás
      for (let g = 0; g <= 4; g++) {
        const y = alto - (alto * g) / 4;
        c.push({ type: 'line', x1: 0, y1: y, x2: ancho, y2: y,
                 lineWidth: g === 0 ? 0.9 : 0.35, lineColor: g === 0 ? AZUL_MED : '#E4E9F3' });
      }
      // Barras
      datos.forEach((d, i) => {
        const h = Math.max(1, (d.valor / maxVal) * (alto - 12));
        const x = gap + i * (anchoB + gap);
        c.push({ type: 'rect', x, y: alto - h, w: anchoB, h,
                 color: d.color ?? AZUL_MED, r: 1 });
      });
      // Línea de promedio por encima de las barras
      if (promedio !== null && promedio > 0) {
        const y = alto - (promedio / maxVal) * (alto - 12);
        c.push({ type: 'line', x1: 0, y1: y, x2: ancho, y2: y,
                 lineWidth: 1.1, lineColor: ROJO, dash: { length: 3, space: 2 } });
      }

      // Etiquetas de valor y de categoría, alineadas con cada barra
      const valores = { columns: datos.map((d, i) => ({
        width: anchoB + gap,
        text: etiquetaValor(d.valor), fontSize: 6.5, bold: true, color: AZUL,
        alignment: 'center',
      })), columnGap: 0, margin: [gap, 2, 0, 0] };

      const etiquetas = { columns: datos.map(d => ({
        width: anchoB + gap,
        text: d.etiqueta, fontSize: 6, color: TX_SUAVE, alignment: 'center',
      })), columnGap: 0, margin: [gap, 1, 0, 0] };

      return {
        stack: [
          { canvas: c },
          valores,
          etiquetas,
          ...(promedio !== null && promedio > 0
            ? [{ text: `- - -  Promedio: ${etiquetaValor(promedio)}`, fontSize: 6.5,
                 color: ROJO, alignment: 'right', margin: [0, 2, 2, 0] }]
            : []),
        ],
      };
    };

    /** Barra horizontal apilada — composición de la membresía. */
    const barraApilada = (
      partes: { etiqueta: string; valor: number; color: string }[],
      ancho = 500,
    ): any => {
      const total = partes.reduce((s, p) => s + p.valor, 0);
      if (total <= 0) {
        return { text: 'Sin membresía registrada.', fontSize: 7.5, italics: true,
                 color: TX_SUAVE, alignment: 'center', margin: [0, 6, 0, 6] };
      }
      const alto = 16;
      const c: any[] = [];
      let x = 0;
      partes.forEach(p => {
        if (p.valor <= 0) return;
        const w = (p.valor / total) * ancho;
        c.push({ type: 'rect', x, y: 0, w, h: alto, color: p.color });
        x += w;
      });
      c.push({ type: 'rect', x: 0, y: 0, w: ancho, h: alto,
               lineWidth: 0.6, lineColor: LINEA, color: undefined });
      const leyenda = {
        columns: partes.filter(p => p.valor > 0).map(p => ({
          width: 'auto',
          columns: [
            { canvas: [{ type: 'rect', x: 0, y: 1.5, w: 6, h: 6, color: p.color }], width: 9 },
            { text: `${p.etiqueta}: ${p.valor}`, fontSize: 6.8, color: TX_SUAVE, width: 'auto' },
          ],
          columnGap: 2,
        })),
        columnGap: 12,
        margin: [0, 4, 0, 0],
      };
      return { stack: [{ canvas: c }, leyenda] };
    };

    // ── Tabla membresía ───────────────────────────────────────────────────────
    const membresiaBody: any[][] = [
      [ hdr('ALTAS/BAJAS'), hdr('CUM'), { ...hdr('NOMBRE'), colSpan: 1 } ],
    ];
    if (informe.altasBajas.length === 0) {
      membresiaBody.push(filaVacia(3, 'Sin altas ni bajas registradas en el periodo.'));
    } else {
      informe.altasBajas.forEach(ab => {
        membresiaBody.push([
          { ...cell(ab.tipo === 'alta' ? 'ALTA' : 'BAJA'),
            bold: true, color: ab.tipo === 'alta' ? VERDE : ROJO },
          cellC(ab.cum ?? ''),
          cell(ab.nombre ?? ''),
        ]);
      });
    }
    membresiaBody.push([
      { text: 'REGISTRADOS', colSpan: 1, ...hdr('REGISTRADOS') },
      cellC(informe.totalRegistrados, { bold: true }),
      {
        columns: [
          { text: 'ENLACE', bold: true, fontSize: 8, width: 55 },
          { text: String(informe.totalEnlace), fontSize: 8, width: 30 },
          { text: 'CAPTACIÓN', bold: true, fontSize: 8, width: 65 },
          { text: String(informe.totalCaptacion), fontSize: 8, width: 30 },
          { text: 'NO REGISTRADOS', bold: true, fontSize: 8, width: 90 },
          { text: String(informe.totalNoRegistrados), fontSize: 8 },
        ],
        margin: [2, 3, 2, 3],
      },
    ]);

    // ── Tabla actividades ─────────────────────────────────────────────────────
    const actBody: any[][] = [
      [ hdr('DÍA', { alignment: 'center' }), hdr('ACTIVIDAD'), hdr('ASIST.'), hdr('OBSERVACIONES') ],
    ];
    const maxAct = informe.actividades.length;
    for (let i = 0; i < maxAct; i++) {
      const a = informe.actividades[i];
      const asistentes: string[] = Array.isArray(a?.asistentes) ? a.asistentes : [];
      const count = a?.asistencia ?? 0;

      // Fila principal
      actBody.push([
        cellC(a ? fmtDia(a.fecha) : ''),
        cell(a?.actividad?.toUpperCase() ?? ''),
        cellC(count || ''),
        cell(a?.observaciones?.toUpperCase() ?? ''),
      ]);

      // Renglón de asistentes (solo si hay nombres)
      if (asistentes.length > 0) {
        // Dividir en columnas de 3 para que no ocupe tanto espacio vertical
        const cols = 3;
        const rows: string[][] = [];
        for (let r = 0; r < asistentes.length; r += cols) {
          rows.push(asistentes.slice(r, r + cols));
        }
        actBody.push([
          { text: '', border: [true, false, false, true], margin: [0,0,0,0] },
          {
            colSpan: 3,
            border: [false, false, true, true],
            margin: [3, 1, 3, 3],
            table: {
              widths: ['*', '*', '*'],
              body: rows.map(row => {
                const cells = row.map(n => ({ text: n, fontSize: 6.5, color: '#333333', margin: [2,1,2,1] }));
                // Rellenar celdas vacías si la fila tiene menos de 3 nombres
                while (cells.length < cols) cells.push({ text: '', fontSize: 6.5, color: '#333333', margin: [2,1,2,1] });
                return cells;
              }),
            },
            layout: 'noBorders',
          },
          {}, {},
        ]);
      }
    }
    if (informe.actividades.length === 0) {
      actBody.push(filaVacia(4, 'Sin actividades registradas en el periodo.'));
    }
    actBody.push([
      { text: 'PROMEDIO DE ASISTENCIA', colSpan: 2, bold: true, fontSize: 8, alignment: 'right',
        fillColor: ORO, color: AZUL, margin: [2,4,6,4] },
      {},
      cellC(promedio, { bold: true, fillColor: ORO, color: AZUL, fontSize: 9 }),
      { text: '', fillColor: ORO },
    ]);

    // ── Tabla actividades pendientes ──────────────────────────────────────────
    const pendBody: any[][] = [
      [ hdr('ACTIVIDAD'), hdr('OBSERVACIONES') ],
    ];
    if (informe.actividadesPendientes.length === 0) {
      pendBody.push(filaVacia(2, 'Sin actividades pendientes por realizar.'));
    } else {
      informe.actividadesPendientes.forEach(p => {
        pendBody.push([
          cell(p.actividad?.toUpperCase() ?? ''),
          cell(p.observaciones?.toUpperCase() ?? ''),
        ]);
      });
    }

    // ── Tabla caja chica (T-account) ──────────────────────────────────────────
    const maxFin = Math.max(ingresos.length, egresos.length);
    const cajaBody: any[][] = [
      [
        { text: 'INGRESOS', colSpan: 3, ...hdr('INGRESOS'), fillColor: VERDE, fontSize: 8.5 },
        {}, {},
        { text: 'EGRESOS', colSpan: 3, ...hdr('EGRESOS'), fillColor: ROJO, fontSize: 8.5 },
        {}, {},
      ],
      [
        hdr('FECHA'), hdr('CONCEPTO'), hdr('CANTIDAD'),
        hdr('FECHA'), hdr('CONCEPTO'), hdr('CANTIDAD'),
      ],
    ];
    for (let i = 0; i < maxFin; i++) {
      const ing = ingresos[i];
      const egr = egresos[i];
      cajaBody.push([
        cellC(ing ? fmt(ing.fecha) : ''),
        cell(ing?.concepto ?? ''),
        cellC(ing ? peso(ing.cantidad) : ''),
        cellC(egr ? fmt(egr.fecha) : ''),
        cell(egr?.concepto ?? ''),
        cellC(egr ? peso(egr.cantidad) : ''),
      ]);
    }
    if (maxFin === 0) {
      cajaBody.push(filaVacia(6, 'Sin movimientos de caja chica en el periodo.'));
    }
    cajaBody.push([
      { text: 'TOTAL INGRESOS', colSpan: 2, bold: true, fontSize: 8, alignment: 'right',
        fillColor: '#EAF5EE', color: VERDE, margin: [2,3,2,3] }, {},
      cellC(peso(totalIngresos), { bold: true, fillColor: '#EAF5EE', color: VERDE }),
      { text: 'TOTAL EGRESOS', colSpan: 2, bold: true, fontSize: 8, alignment: 'right',
        fillColor: '#FBECEB', color: ROJO, margin: [2,3,2,3] }, {},
      cellC(peso(totalEgresos), { bold: true, fillColor: '#FBECEB', color: ROJO }),
    ]);
    cajaBody.push([
      { text: 'SALDO INICIAL', colSpan: 2, bold: true, fontSize: 8, alignment: 'right',
        fillColor: ORO_CLR, color: AZUL, margin: [2,3,2,3] }, {},
      cellC(peso(informe.saldoInicial), { bold: true, fillColor: ORO_CLR, color: AZUL }),
      { text: 'SALDO ACTUAL', colSpan: 2, bold: true, fontSize: 8, alignment: 'right',
        fillColor: ORO, color: AZUL, margin: [2,3,2,3] }, {},
      cellC(peso(saldoActual), { bold: true, fillColor: ORO, color: AZUL }),
    ]);

    // ── Inventario ────────────────────────────────────────────────────────────
    const invBody: any[][] = [
      [ hdr('AÑO'), hdr('MARCA'), hdr('DESCRIPCIÓN'), hdr('CANT.'), hdr('OBSERVACIONES') ],
    ];
    inventario.forEach(item => {
      invBody.push([
        cellC(item.anioCompra ?? ''),
        cell(item.marca ?? ''),
        cell(item.descripcion),
        cellC(item.cantidad),
        cell(item.observaciones ?? ''),
      ]);
    });
    if (inventario.length === 0) {
      invBody.push(filaVacia(5, 'Sin artículos registrados en el inventario.'));
    }

    // ── Progresión personal ────────────────────────────────────────────────────
    const progBody: any[][] = [
      [ hdr('ENTREGA DE INSIGNIAS Y/O\nRECONOCIMIENTOS'), hdr('NOMBRE'), hdr('FECHA') ],
    ];
    if (informe.progresiones.length === 0) {
      progBody.push(filaVacia(3, 'Sin entregas de insignias o reconocimientos en el periodo.'));
    } else {
      informe.progresiones.forEach(p => {
        progBody.push([
          cell(p.descripcion ?? ''),
          cell(p.nombre ?? ''),
          cellC(fmt(p.fecha)),
        ]);
      });
    }

    // ── Fecha de elaboración y datos de portada ───────────────────────────────
    const hoy = new Date();
    // El contenedor corre en UTC; el informe debe fecharse en hora local de Morelia
    const TZ = 'America/Mexico_City';
    const fechaLarga = hoy.toLocaleDateString('es-MX',
      { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
    const fechaCorta = hoy.toLocaleDateString('es-MX',
      { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
    const horaGen = hoy.toLocaleTimeString('es-MX',
      { hour: '2-digit', minute: '2-digit', timeZone: TZ });
    const totalActividades = informe.actividades.length;
    const totalAsistencias = informe.actividades.reduce((s, a) => s + (a.asistencia ?? 0), 0);

    // Datos para las gráficas
    const datosAsistencia = informe.actividades
      .filter(a => (a.asistencia ?? 0) >= 0)
      .map(a => ({
        etiqueta: fmtDia(a.fecha) === '—' ? '—' : `${fmtDia(a.fecha)} ${mesLabel.slice(0, 3)}`,
        valor: a.asistencia ?? 0,
        color: (a.asistencia ?? 0) >= promedio ? AZUL_MED : ORO,
      }));

    const datosFinanzas = [
      { etiqueta: 'Saldo inicial', valor: Number(informe.saldoInicial) || 0, color: AZUL },
      { etiqueta: 'Ingresos',      valor: totalIngresos,                     color: VERDE },
      { etiqueta: 'Egresos',       valor: totalEgresos,                      color: ROJO },
      { etiqueta: 'Saldo actual',  valor: saldoActual,                       color: ORO_OSC },
    ].filter(d => d.valor !== 0);

    // ── Documento ─────────────────────────────────────────────────────────────
    const dd: any = {
      pageSize: 'LETTER',
      pageOrientation: 'portrait',
      pageMargins: [32, 30, 32, 46],
      info: {
        title:    `Informe mensual ${mesLabel} ${informe.anio} — ${seccionLabel}`,
        author:   jefeNombre,
        subject:  `Informe mensual de actividades — ${seccionLabel}`,
        creator:  'Grupo Scout 7 Morelia "Itsï Tarhiáta"',
      },
      defaultStyle: { font: 'Roboto', fontSize: 9, color: BK },
      images: {
        ...(this.logoGrupo ? { logoGrupo: this.logoGrupo } : {}),
        ...(this.logoCC    ? { logoCC:    this.logoCC    } : {}),
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
        // ─ Encabezado ─
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
                  { text: 'INFORME MENSUAL DE ACTIVIDADES', fontSize: 15, bold: true,
                    color: AZUL, characterSpacing: 0.4, alignment: 'center' },
                  { canvas: [{ type: 'line', x1: 96, y1: 0, x2: 236, y2: 0,
                               lineWidth: 1.6, lineColor: ORO }], margin: [0, 4, 0, 4] },
                  { text: seccionLabel.toUpperCase(), fontSize: 10.5, bold: true,
                    color: AZUL_MED, alignment: 'center' },
                  { text: 'CHUPÍ-TIRÍPEME  ·  GRUPO SCOUT 7 MORELIA "ITSÏ TARHIÁTA"',
                    fontSize: 7.5, color: TX_SUAVE, alignment: 'center', margin: [0, 2, 0, 5] },
                  { table: { widths: ['auto'], body: [[{
                      text: `${mesLabel.toUpperCase()} DE ${informe.anio}`,
                      fontSize: 9.5, bold: true, color: AZUL, fillColor: ORO,
                      margin: [14, 3, 14, 3], alignment: 'center',
                    }]] },
                    layout: 'noBorders', alignment: 'center', margin: [0, 0, 0, 9] },
                ],
              },
              this.logoCC
                ? { image: 'logoCC', width: 84, alignment: 'center', margin: [2, 8, 2, 8] }
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

        // ─ Resumen del mes (indicadores) ─
        sectionTitle('RESUMEN DEL MES'),
        {
          columns: [
            tarjeta(informe.totalRegistrados, 'Registrados',  AZUL),
            tarjeta(totalActividades,         'Actividades',  AZUL_MED),
            tarjeta(promedio,                 'Asist. prom.', ORO_OSC),
            tarjeta(totalAsistencias,         'Asistencias',  AZUL_MED),
            tarjeta(peso(saldoActual),        'Saldo actual', saldoActual >= 0 ? VERDE : ROJO),
          ],
          columnGap: 7,
          margin: [0, 8, 0, 0],
        },

        // ─ Membresía ─
        sectionTitle('INFORME DE MEMBRESÍA'),
        {
          table: { widths: [70, 50, '*'], body: membresiaBody, headerRows: 1 },
          layout: tablaLayout(),
          margin: [0, 6, 0, 0],
        },
        {
          stack: [
            { text: 'COMPOSICIÓN DE LA MEMBRESÍA', fontSize: 7, bold: true,
              color: AZUL, characterSpacing: 0.5, margin: [0, 0, 0, 4] },
            barraApilada([
              { etiqueta: 'Registrados',    valor: informe.totalRegistrados,    color: AZUL_MED },
              { etiqueta: 'Enlace',         valor: informe.totalEnlace,         color: ORO },
              { etiqueta: 'Captación',      valor: informe.totalCaptacion,      color: VERDE },
              { etiqueta: 'No registrados', valor: informe.totalNoRegistrados,  color: '#9AA5BC' },
            ], 548),
          ],
          margin: [0, 9, 0, 0],
        },

        // ─ Actividades ─
        sectionTitle('INFORME DE ACTIVIDADES'),
        {
          table: { widths: [35, '*', 50, '*'], body: actBody, headerRows: 1 },
          layout: tablaLayout({ zebra: false }),
          margin: [0, 6, 0, 0],
        },
        // Gráfica de asistencia por actividad
        {
          unbreakable: true,
          stack: [
            { text: 'ASISTENCIA POR ACTIVIDAD', fontSize: 7, bold: true,
              color: AZUL, characterSpacing: 0.5, margin: [0, 0, 0, 5] },
            graficaBarras(datosAsistencia, { ancho: 548, alto: 105, promedio: promedio }),
          ],
          margin: [0, 10, 0, 0],
        },

        // ─ Pendientes ─
        sectionTitle('ACTIVIDADES POR REALIZAR'),
        {
          table: { widths: ['*', '*'], body: pendBody, headerRows: 1 },
          layout: tablaLayout(),
          margin: [0, 6, 0, 0],
        },

        // ─ Caja chica ─
        sectionTitle('INFORME DE CAJA CHICA'),
        {
          table: { widths: [54, '*', 56, 54, '*', 56], body: cajaBody, headerRows: 2 },
          layout: tablaLayout({ desde: 2 }),
          margin: [0, 6, 0, 0],
        },
        // Gráfica de movimientos financieros
        {
          unbreakable: true,
          stack: [
            { text: 'MOVIMIENTO FINANCIERO DEL MES', fontSize: 7, bold: true,
              color: AZUL, characterSpacing: 0.5, margin: [0, 0, 0, 5] },
            graficaBarras(datosFinanzas, { ancho: 548, alto: 95, formato: peso }),
          ],
          margin: [0, 10, 0, 0],
        },

        // ─ Inventario ─
        sectionTitle('INVENTARIO'),
        {
          table: { widths: [42, 52, '*', 34, '*'], body: invBody, headerRows: 1 },
          layout: tablaLayout(),
          margin: [0, 6, 0, 0],
        },

        // ─ Progresión ─
        sectionTitle('INFORME DE PROGRESIÓN PERSONAL'),
        {
          table: { widths: [140, '*', 70], body: progBody, headerRows: 1 },
          layout: tablaLayout(),
          margin: [0, 6, 0, 0],
        },

        // ─ Observaciones ─
        sectionTitle('OBSERVACIONES'),
        {
          table: { widths: ['*'], body: [[
            { text: informe.observacionesGenerales?.trim()
                    || 'Sin observaciones adicionales para este periodo.',
              fontSize: 8, italics: !informe.observacionesGenerales?.trim(),
              color: informe.observacionesGenerales?.trim() ? BK : TX_SUAVE,
              margin: [8, 10, 8, 10] },
          ]] },
          layout: {
            hLineWidth: () => 0.6, vLineWidth: (i: number) => (i === 0 ? 2.4 : 0.6),
            hLineColor: () => LINEA,
            vLineColor: (i: number) => (i === 0 ? ORO : LINEA),
          },
          margin: [0, 6, 0, 16],
        },

        // ─ Firmas ─
        {
          unbreakable: true,
          stack: [
            // Lugar y fecha de elaboración
            { text: `Morelia, Michoacán, a ${fechaLarga}.`,
              fontSize: 8.5, alignment: 'right', color: BK, margin: [0, 0, 4, 14] },

            { text: 'A T E N T A M E N T E', bold: true, fontSize: 9.5, color: AZUL,
              characterSpacing: 1, alignment: 'center', margin: [0, 0, 0, 2] },
            { text: '«Siempre Listos para Servir»', fontSize: 7.5, italics: true,
              color: TX_SUAVE, alignment: 'center', margin: [0, 0, 0, 30] },

            // Elabora / Revisa
            {
              columns: [
                firma(jefeNombre,    `Jefe de ${seccionLabel}`,    'ELABORA'),
                { width: '*', text: '' },
                firma(subjefeNombre, `Subjefe de ${seccionLabel}`, 'REVISA'),
              ],
              margin: [0, 0, 0, 34],
            },

            // Recibe (Jefe de Grupo), centrado
            {
              columns: [
                { width: '*', text: '' },
                firma(jefeGrupoNombre, 'Jefe de Grupo', 'RECIBE'),
                { width: '*', text: '' },
              ],
              margin: [0, 0, 0, 14],
            },

            // Sello y acuse de recibido
            {
              columns: [
                {
                  width: 176,
                  table: { widths: ['*'], heights: [46], body: [[{
                    text: 'Sello del Grupo', fontSize: 6.5, color: '#B6BECD',
                    alignment: 'center', margin: [0, 20, 0, 0],
                  }]] },
                  layout: {
                    hLineWidth: () => 0.7, vLineWidth: () => 0.7,
                    hLineColor: () => '#D5DBE7', vLineColor: () => '#D5DBE7',
                    hLineStyle: () => ({ dash: { length: 3, space: 2 } }),
                    vLineStyle: () => ({ dash: { length: 3, space: 2 } }),
                  },
                },
                { width: '*', text: '' },
                {
                  width: 250,
                  stack: [
                    { text: 'ACUSE DE RECIBIDO', fontSize: 7, bold: true, color: AZUL,
                      characterSpacing: 0.5, margin: [0, 0, 0, 6] },
                    { columns: [
                        { text: 'Fecha de recepción:', fontSize: 7, color: TX_SUAVE, width: 82 },
                        { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 160, y2: 8,
                                     lineWidth: 0.6, lineColor: '#B6BECD' }], width: '*' },
                      ] },
                    { columns: [
                        { text: 'Folio / observaciones:', fontSize: 7, color: TX_SUAVE, width: 82 },
                        { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 160, y2: 8,
                                     lineWidth: 0.6, lineColor: '#B6BECD' }], width: '*' },
                      ], margin: [0, 8, 0, 0] },
                  ],
                },
              ],
            },
          ],
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

  private seccionLabel(s: string): string {
    return { manada:'Manada de Lobatos', tropa:'Tropa de Scouts',
             comunidad:'Comunidad de Caminantes', clan:'Clan de Rovers',
             grupo:'Grupo Scout' }[s] ?? s;
  }
}
