import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

// ── Colores del PDF (fiel al ejemplo: blanco/negro institucional) ─────────────
const BK = '#000000';
const GR = '#D9D9D9';
const WH = '#FFFFFF';
const LG = '#F2F2F2';

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
    const grupoPath = path.join(assetsDir, 'logo_Grupo.png');
    const ccPath    = path.join(assetsDir, 'logo_CC.png');
    if (fs.existsSync(grupoPath)) this.logoGrupo = `data:image/png;base64,${fs.readFileSync(grupoPath).toString('base64')}`;
    if (fs.existsSync(ccPath))    this.logoCC    = `data:image/png;base64,${fs.readFileSync(ccPath).toString('base64')}`;
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
    const sectionTitle = (text: string) => ({
      table: { widths: ['*'], body: [[
        { text, fontSize: 10, bold: true, alignment: 'center',
          fillColor: BK, color: WH, margin: [4, 4, 4, 4] },
      ]] },
      layout: 'noBorders',
      margin: [0, 8, 0, 0],
    });

    const hdr = (text: string, opts: any = {}) => ({
      text, fontSize: 8, bold: true, alignment: 'center',
      fillColor: GR, color: BK, margin: [2, 4, 2, 4], ...opts,
    });

    const cell = (text: string | number, opts: any = {}) => ({
      text: text === null || text === undefined ? '' : String(text),
      fontSize: 8, alignment: 'left', margin: [3, 3, 3, 3], ...opts,
    });

    const cellC = (text: string | number, opts: any = {}) =>
      cell(text, { alignment: 'center', ...opts });

    // ── Tabla membresía ───────────────────────────────────────────────────────
    const membresiaBody: any[][] = [
      [ hdr('ALTAS/BAJAS'), hdr('CUM'), { ...hdr('NOMBRE'), colSpan: 1 } ],
    ];
    const maxAB = Math.max(informe.altasBajas.length, 4);
    for (let i = 0; i < maxAB; i++) {
      const ab = informe.altasBajas[i];
      membresiaBody.push([
        cell(ab ? (ab.tipo === 'alta' ? 'ALTA' : 'BAJA') : ''),
        cellC(ab?.cum ?? ''),
        cell(ab?.nombre ?? ''),
      ]);
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
    const maxAct = Math.max(informe.actividades.length, 5);
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
    actBody.push([
      { text: 'PROMEDIO DE ASISTENCIA', colSpan: 2, bold: true, fontSize: 8, alignment: 'center',
        fillColor: GR, margin: [2,4,2,4] },
      {},
      cellC(promedio, { bold: true }),
      cell(''),
    ]);

    // ── Tabla actividades pendientes ──────────────────────────────────────────
    const pendBody: any[][] = [
      [ hdr('ACTIVIDAD'), hdr('OBSERVACIONES') ],
    ];
    const maxPend = Math.max(informe.actividadesPendientes.length, 5);
    for (let i = 0; i < maxPend; i++) {
      const p = informe.actividadesPendientes[i];
      pendBody.push([
        cell(p?.actividad?.toUpperCase() ?? ''),
        cell(p?.observaciones?.toUpperCase() ?? ''),
      ]);
    }

    // ── Tabla caja chica (T-account) ──────────────────────────────────────────
    const maxFin = Math.max(ingresos.length, egresos.length, 4);
    const cajaBody: any[][] = [
      [
        { text: 'INGRESOS', colSpan: 3, ...hdr('INGRESOS'), fillColor: LG },
        {}, {},
        { text: 'EGRESOS', colSpan: 3, ...hdr('EGRESOS'), fillColor: LG },
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
    cajaBody.push([
      { text: 'TOTAL INGRESOS', colSpan: 2, bold: true, fontSize: 8, alignment: 'right',
        fillColor: LG, margin: [2,3,2,3] }, {},
      cellC(peso(totalIngresos), { bold: true, fillColor: LG }),
      { text: 'TOTAL EGRESOS', colSpan: 2, bold: true, fontSize: 8, alignment: 'right',
        fillColor: LG, margin: [2,3,2,3] }, {},
      cellC(peso(totalEgresos), { bold: true, fillColor: LG, color: '#CC0000' }),
    ]);
    cajaBody.push([
      { text: 'SALDO INICIAL', colSpan: 2, bold: true, fontSize: 8, alignment: 'right',
        fillColor: GR, margin: [2,3,2,3] }, {},
      cellC(peso(informe.saldoInicial), { bold: true, fillColor: GR }),
      { text: 'SALDO ACTUAL', colSpan: 2, bold: true, fontSize: 8, alignment: 'right',
        fillColor: GR, margin: [2,3,2,3] }, {},
      cellC(peso(saldoActual), { bold: true, fillColor: GR }),
    ]);

    // ── Inventario ────────────────────────────────────────────────────────────
    const invBody: any[][] = [
      [ hdr('AÑO DE COMPRA'), hdr('MARCA'), hdr('DESCRIPCIÓN'), hdr('CANTIDAD'), hdr('OBSERVACIONES') ],
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
      invBody.push([ cell(''), cell(''), cell('Sin artículos registrados'), cell(''), cell('') ]);
    }

    // ── Progresión personal ────────────────────────────────────────────────────
    const progBody: any[][] = [
      [ hdr('ENTREGA DE INSIGNIAS Y/O\nRECONOCIMIENTOS'), hdr('NOMBRE'), hdr('FECHA') ],
    ];
    const maxProg = Math.max(informe.progresiones.length, 7);
    for (let i = 0; i < maxProg; i++) {
      const p = informe.progresiones[i];
      progBody.push([
        cell(p?.descripcion ?? ''),
        cell(p?.nombre ?? ''),
        cellC(p ? fmt(p.fecha) : ''),
      ]);
    }

    // ── Documento ─────────────────────────────────────────────────────────────
    const dd: any = {
      pageSize: 'LETTER',
      pageOrientation: 'portrait',
      pageMargins: [30, 30, 30, 30],
      defaultStyle: { font: 'Roboto', fontSize: 9, color: BK },
      images: {
        ...(this.logoGrupo ? { logoGrupo: this.logoGrupo } : {}),
        ...(this.logoCC    ? { logoCC:    this.logoCC    } : {}),
      },
      content: [
        // ─ Encabezado ─
        {
          table: {
            widths: [80, '*', 80],
            body: [[
              this.logoGrupo
                ? { image: 'logoGrupo', width: 70, alignment: 'center', margin: [4, 6, 4, 6] }
                : { text: '⚜', fontSize: 28, alignment: 'center', margin: [0, 8, 0, 8] },
              {
                stack: [
                  { text: 'INFORME MENSUAL DE ACTIVIDADES', fontSize: 13, bold: true, alignment: 'center', margin: [0, 6, 0, 2] },
                  { text: seccionLabel.toUpperCase(), fontSize: 10, bold: true, alignment: 'center' },
                  { text: 'CHUPI-TIRÍPEME', fontSize: 9, alignment: 'center', margin: [0, 1, 0, 1] },
                  { text: 'GRUPO SCOUT 7 MORELIA "ITSÏ TARHIÁTA"', fontSize: 8, alignment: 'center' },
                  { text: `${mesLabel.toUpperCase()} DE ${informe.anio}`, fontSize: 10, bold: true, alignment: 'center', margin: [0, 3, 0, 6] },
                ],
              },
              this.logoCC
                ? { image: 'logoCC', width: 70, alignment: 'center', margin: [4, 6, 4, 6] }
                : { text: '⚜', fontSize: 28, alignment: 'center', margin: [0, 8, 0, 8] },
            ]],
          },
          layout: { hLineWidth: () => 1, vLineWidth: () => 1,
                    hLineColor: () => BK, vLineColor: () => BK },
          margin: [0, 0, 0, 0],
        },

        // ─ Membresía ─
        sectionTitle('INFORME DE MEMBRESIA'),
        {
          table: { widths: [70, 50, '*'], body: membresiaBody },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                    hLineColor: () => BK, vLineColor: () => BK },
        },

        // ─ Actividades ─
        sectionTitle('INFORME DE ACTIVIDADES'),
        {
          table: { widths: [35, '*', 50, '*'], body: actBody },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                    hLineColor: () => BK, vLineColor: () => BK },
        },

        // ─ Pendientes ─
        sectionTitle('ACTIVIDADES POR REALIZAR'),
        {
          table: { widths: ['*', '*'], body: pendBody },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                    hLineColor: () => BK, vLineColor: () => BK },
        },

        // ─ Caja chica ─
        sectionTitle('INFORME DE CAJA CHICA'),
        {
          table: { widths: [48, '*', 55, 48, '*', 55], body: cajaBody },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                    hLineColor: () => BK, vLineColor: () => BK },
        },

        // ─ Inventario ─
        sectionTitle('INVENTARIO'),
        {
          table: { widths: [55, 50, '*', 40, '*'], body: invBody },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                    hLineColor: () => BK, vLineColor: () => BK },
        },

        // ─ Progresión ─
        sectionTitle('INFORME DE PROGRESION PERSONAL'),
        {
          table: { widths: [140, '*', 70], body: progBody },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                    hLineColor: () => BK, vLineColor: () => BK },
        },

        // ─ Observaciones ─
        sectionTitle('OBSERVACIONES'),
        {
          table: { widths: ['*'], body: [[
            { text: informe.observacionesGenerales ?? '', fontSize: 8, margin: [4, 10, 4, 10], minHeight: 25 },
          ]] },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                    hLineColor: () => BK, vLineColor: () => BK },
          margin: [0, 0, 0, 20],
        },

        // ─ Firmas ─
        { text: 'A T E N T A M E N T E', bold: true, fontSize: 9, alignment: 'center', margin: [0, 10, 0, 20] },
        {
          columns: [
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: BK }] },
                { text: jefeNombre.toUpperCase(), fontSize: 8, bold: true, alignment: 'center', margin: [0,2,0,0] },
                { text: `Jefe de ${seccionLabel}`, fontSize: 7, alignment: 'center', color: '#555' },
              ],
              width: 170,
            },
            { width: '*', text: '' },
            {
              stack: [
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: BK }] },
                { text: subjefeNombre.toUpperCase(), fontSize: 8, bold: true, alignment: 'center', margin: [0,2,0,0] },
                { text: `Subjefe de ${seccionLabel}`, fontSize: 7, alignment: 'center', color: '#555' },
              ],
              width: 170,
            },
          ],
          margin: [0, 0, 0, 24],
        },
        {
          columns: [
            { width: '*', text: '' },
            {
              stack: [
                { text: 'RECIBE', bold: true, fontSize: 9, alignment: 'center', margin: [0, 0, 0, 10] },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 160, y2: 0, lineWidth: 1, lineColor: BK }] },
                { text: jefeGrupoNombre.toUpperCase(), fontSize: 8, bold: true, alignment: 'center', margin: [0,2,0,0] },
                { text: 'Jefe de Grupo', fontSize: 7, alignment: 'center', color: '#555' },
              ],
              width: 170,
            },
            { width: '*', text: '' },
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
