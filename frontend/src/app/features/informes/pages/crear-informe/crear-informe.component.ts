import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { InformeService } from '../../../../core/services/informe.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CaminanteService } from '../../../../core/services/caminante.service';
import {
  AltaBaja, AsistenciaActividad, ActividadPendiente,
  MovimientoFinanciero, InventarioItem, ProgresionInforme,
  InformeMensual, MESES_NOMBRES,
} from '../../../../core/models/informe.model';
import { CicloProgramaService } from '../../../../core/services/ciclo-programa.service';
import { ActividadCiclo } from '../../../../core/models/ciclo-programa.model';

type SaveState = 'idle' | 'guardando' | 'guardado' | 'error';
type Tab = 'membresia' | 'actividades' | 'financiero' | 'inventario' | 'progresion';

@Component({
  selector: 'app-crear-informe',
  templateUrl: './crear-informe.component.html',
  styleUrls: ['./crear-informe.component.scss'],
})
export class CrearInformeComponent implements OnInit, OnDestroy {
  // ── Flujo de creación ────────────────────────────────────────────────────────
  /** 'init' = formulario cabecera; 'tabs' = edición por tabs con auto-save */
  paso: 'init' | 'tabs' = 'init';
  informeId: number | null = null;  // null = nuevo, number = ID guardado
  creandoCabecera = false;

  // Formulario de cabecera (paso init)
  configForm!: FormGroup;
  seccion = 'comunidad';

  // Pre-carga desde mes anterior
  ultimoInforme: (InformeMensual & { saldoActual: number }) | null = null;
  cargandoUltimo = false;

  readonly mesesOpts = MESES_NOMBRES.slice(1).map((m, i) => ({ label: m, value: i + 1 }));
  readonly anioOpts  = (() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1].map(n => ({ label: n.toString(), value: n }));
  })();

  // ── Secciones del informe ────────────────────────────────────────────────────
  altasBajas:            AltaBaja[]            = [];
  actividades:           AsistenciaActividad[] = [];
  actividadesPendientes: ActividadPendiente[]  = [];
  ingresos:              MovimientoFinanciero[] = [];
  egresos:               MovimientoFinanciero[] = [];
  inventario:            InventarioItem[]       = [];
  progresiones:          ProgresionInforme[]    = [];

  // Estado de auto-guardado por tab
  estado: Record<Tab, SaveState> = {
    membresia:   'idle',
    actividades: 'idle',
    financiero:  'idle',
    inventario:  'idle',
    progresion:  'idle',
  };

  // Triggers de auto-save por tab
  private save$ = {
    membresia:   new Subject<void>(),
    actividades: new Subject<void>(),
    financiero:  new Subject<void>(),
    progresion:  new Subject<void>(),
  };
  private destroy$ = new Subject<void>();

  // PDF
  generando = false;

  // Caminantes para dropdowns
  caminanteOpts: { label: string; value: string }[] = [];

  // Catálogo de insignias/especialidades para dropdown progresión
  descripcionGroupedOpts: { label: string; items: { label: string; value: string }[] }[] = [];

  // Dialogs inventario
  showInvDialog = false;
  invForm!: FormGroup;
  editingInvId: number | null = null;

  constructor(
    private fb:             FormBuilder,
    private svc:            InformeService,
    private authService:    AuthService,
    private caminanteSvc:   CaminanteService,
    private cicloProgramaSvc: CicloProgramaService,
    private msg:            MessageService,
    private route:          ActivatedRoute,
    private router:         Router,
  ) {}

  ngOnInit() {
    const user = this.authService.getUser();
    this.seccion = user ? this.authService.getSeccion(user.rol) : 'comunidad';
    const now = new Date();

    this.configForm = this.fb.group({
      mes:                    [now.getMonth() + 1, Validators.required],
      anio:                   [now.getFullYear(),   Validators.required],
      seccion:                [this.seccion],
      saldoInicial:           [0, [Validators.required, Validators.min(0)]],
      observacionesGenerales: [''],
    });

    this.invForm = this.fb.group({
      anioCompra:    [new Date().getFullYear()],
      marca:         [''],
      descripcion:   ['', Validators.required],
      cantidad:      [1, [Validators.required, Validators.min(1)]],
      observaciones: [''],
    });

    // Membresía totales (separados para auto-save fácil)
    this._membresiaForm = this.fb.group({
      totalRegistrados:   [0, [Validators.required, Validators.min(0)]],
      totalEnlace:        [0, [Validators.required, Validators.min(0)]],
      totalCaptacion:     [0, [Validators.required, Validators.min(0)]],
      totalNoRegistrados: [0, [Validators.required, Validators.min(0)]],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.informeId = +id;
      this.paso = 'tabs';
      this._cargarInforme(this.informeId);
    } else {
      // Nuevo: buscar el último para ofrecer pre-carga
      this.cargandoUltimo = true;
      this.svc.getUltimo(this.seccion).subscribe({
        next: (u) => {
          this.ultimoInforme = u;
          this.cargandoUltimo = false;
          if (u) {
            // Pre-llenar saldo inicial automáticamente con el saldo final del mes anterior
            this.configForm.patchValue({ saldoInicial: u.saldoActual });
          }
        },
        error: () => { this.cargandoUltimo = false; },
      });
    }

    // Cargar lista de caminantes para los dropdowns
    this.caminanteSvc.getAll().subscribe({
      next: (list) => {
        this.caminanteOpts = list.map(c => ({
          label: `${c.nombre}${c.apellidos ? ' ' + c.apellidos : ''}`,
          value: `${c.nombre}${c.apellidos ? ' ' + c.apellidos : ''}`,
        }));
      },
    });

    // Cargar catálogo de insignias/especialidades
    this._buildDescripcionOpts([]);
    this.svc.getCatalogoProgresion().subscribe({
      next: (catalog) => this._buildDescripcionOpts(catalog),
    });

    this._subscribeAutoSave();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Formulario de membresía (tab) ────────────────────────────────────────────
  _membresiaForm!: FormGroup;

  // ── Carga de informe existente ───────────────────────────────────────────────
  private _cargarInforme(id: number) {
    this.svc.getOne(id).subscribe({
      next: (inf) => {
        this.configForm.patchValue({
          mes: inf.mes, anio: inf.anio, seccion: inf.seccion,
          saldoInicial: inf.saldoInicial,
          observacionesGenerales: inf.observacionesGenerales ?? '',
        });
        this._membresiaForm.patchValue({
          totalRegistrados:   inf.totalRegistrados,
          totalEnlace:        inf.totalEnlace,
          totalCaptacion:     inf.totalCaptacion,
          totalNoRegistrados: inf.totalNoRegistrados,
        });
        this.seccion = inf.seccion;
        this.altasBajas            = [...inf.altasBajas];
        this.actividades           = [...inf.actividades];
        this.actividadesPendientes = [...inf.actividadesPendientes];
        this.ingresos              = inf.movimientos.filter(m => m.tipo === 'ingreso');
        this.egresos               = inf.movimientos.filter(m => m.tipo === 'egreso');
        this.progresiones          = [...inf.progresiones];
        this.loadInventario();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el informe.' });
      },
    });
  }

  // ── Auto-save subscriptions ──────────────────────────────────────────────────
  private _subscribeAutoSave() {
    // Membresía
    this.save$.membresia.pipe(
      debounceTime(1500),
      switchMap(() => {
        this.estado.membresia = 'guardando';
        return this.svc.patchMembresia(this.informeId!, {
          ...this._membresiaForm.value,
          altasBajas: this.altasBajas.map((a, i) => ({ ...a, orden: i })),
        });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next:  () => { this.estado.membresia = 'guardado'; setTimeout(() => { this.estado.membresia = 'idle'; }, 2500); },
      error: () => { this.estado.membresia = 'error'; },
    });

    // Actividades
    this.save$.actividades.pipe(
      debounceTime(1500),
      switchMap(() => {
        this.estado.actividades = 'guardando';
        return this.svc.patchActividades(this.informeId!, {
          actividades:           this.actividades.map((a, i) => ({ ...a, orden: i })),
          actividadesPendientes: this.actividadesPendientes.map((a, i) => ({ ...a, orden: i })),
        });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next:  () => { this.estado.actividades = 'guardado'; setTimeout(() => { this.estado.actividades = 'idle'; }, 2500); },
      error: () => { this.estado.actividades = 'error'; },
    });

    // Financiero
    this.save$.financiero.pipe(
      debounceTime(1500),
      switchMap(() => {
        this.estado.financiero = 'guardando';
        return this.svc.patchFinanciero(this.informeId!, {
          saldoInicial: Number(this.configForm.value.saldoInicial),
          movimientos:  [
            ...this.ingresos.map((m, i) => ({ ...m, tipo: 'ingreso' as const, orden: i })),
            ...this.egresos.map((m, i)  => ({ ...m, tipo: 'egreso'  as const, orden: i })),
          ],
        });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next:  () => { this.estado.financiero = 'guardado'; setTimeout(() => { this.estado.financiero = 'idle'; }, 2500); },
      error: () => { this.estado.financiero = 'error'; },
    });

    // Progresión
    this.save$.progresion.pipe(
      debounceTime(1500),
      switchMap(() => {
        this.estado.progresion = 'guardando';
        return this.svc.patchProgresion(this.informeId!, {
          progresiones:           this.progresiones.map((p, i) => ({ ...p, orden: i })),
          observacionesGenerales: this.configForm.value.observacionesGenerales,
        });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next:  () => { this.estado.progresion = 'guardado'; setTimeout(() => { this.estado.progresion = 'idle'; }, 2500); },
      error: () => { this.estado.progresion = 'error'; },
    });
  }

  // ── Helpers de trigger ───────────────────────────────────────────────────────
  triggerMembresia()   { if (this.informeId) this.save$.membresia.next(); }
  triggerActividades() { if (this.informeId) this.save$.actividades.next(); }
  triggerFinanciero()  { if (this.informeId) this.save$.financiero.next(); }
  triggerProgresion()  { if (this.informeId) this.save$.progresion.next(); }

  // ── Paso init: crear cabecera ────────────────────────────────────────────────
  get siguienteMesLabel(): string {
    if (!this.ultimoInforme) return '';
    const { mes, anio } = this.ultimoInforme;
    const sig     = mes === 12 ? 1 : mes + 1;
    const sigAnio = mes === 12 ? anio + 1 : anio;
    return `${MESES_NOMBRES[sig]} ${sigAnio}`;
  }

  cargarDesdeMesAnterior() {
    if (!this.ultimoInforme) return;
    const u = this.ultimoInforme;
    const sigMes  = u.mes === 12 ? 1 : u.mes + 1;
    const sigAnio = u.mes === 12 ? u.anio + 1 : u.anio;
    this.configForm.patchValue({ mes: sigMes, anio: sigAnio, saldoInicial: u.saldoActual });
    this._membresiaForm.patchValue({
      totalRegistrados:   u.totalRegistrados,
      totalEnlace:        u.totalEnlace,
      totalCaptacion:     u.totalCaptacion,
      totalNoRegistrados: u.totalNoRegistrados,
    });
    this.actividadesPendientes = u.actividadesPendientes.map((p, i) => ({
      actividad: p.actividad, observaciones: p.observaciones, orden: i,
    }));
    this.altasBajas   = [];
    this.ingresos     = [];
    this.egresos      = [];
    this.progresiones = [];
    this.ultimoInforme = null;

    // Pre-cargar actividades desde el ciclo de programa del siguiente mes
    this.cicloProgramaSvc.getActividadesMes(this.seccion, sigAnio, sigMes).subscribe({
      next: (actsCiclo) => {
        this.actividades = this._buildActividades(sigMes, sigAnio, actsCiclo);
        const detalle = actsCiclo.length > 0
          ? `Saldo: $${Number(u.saldoActual).toFixed(2)} · ${actsCiclo.length} actividad(es) del ciclo de programa cargadas.`
          : `Saldo: $${Number(u.saldoActual).toFixed(2)} · Membresía y pendientes del mes anterior cargados.`;
        this.msg.add({ severity: 'success', summary: 'Datos cargados', detail: detalle });
      },
      error: () => {
        this.actividades = this._buildActividades(sigMes, sigAnio, []);
        this.msg.add({
          severity: 'success', summary: 'Datos cargados',
          detail: `Saldo inicial: $${Number(u.saldoActual).toFixed(2)} · Membresía y pendientes del mes anterior cargados.`,
        });
      },
    });
  }

  /** Construye la lista de actividades para un mes combinando sábados con el ciclo de programa */
  private _buildActividades(mes: number, anio: number, actsCiclo: ActividadCiclo[]): AsistenciaActividad[] {
    return this.getSabadosDelMes(mes, anio).map((fecha, i) => {
      const [d, m, y] = fecha.split('/');
      const isoFecha = `${y}-${m}-${d}`;
      const actCiclo = actsCiclo.find(a => a.fechaSabado === isoFecha);
      return {
        fecha,
        actividad:    actCiclo?.nombre        ?? '',
        asistencia:   0,
        asistentes:   [] as string[],
        observaciones: '',
        orden: i,
      };
    });
  }

  /** Devuelve las fechas de todos los sábados de un mes/año en formato DD/MM/YYYY */
  private getSabadosDelMes(mes: number, anio: number): string[] {
    const sabados: string[] = [];
    const fecha = new Date(anio, mes - 1, 1);
    // Avanzar al primer sábado (getDay() === 6)
    while (fecha.getDay() !== 6) { fecha.setDate(fecha.getDate() + 1); }
    while (fecha.getMonth() === mes - 1) {
      const d = fecha.getDate().toString().padStart(2, '0');
      const m = (fecha.getMonth() + 1).toString().padStart(2, '0');
      sabados.push(`${d}/${m}/${anio}`);
      fecha.setDate(fecha.getDate() + 7);
    }
    return sabados;
  }

  crearCabecera() {
    if (this.configForm.invalid) { this.configForm.markAllAsTouched(); return; }
    this.creandoCabecera = true;

    const { mes, anio } = this.configForm.value;
    this.cicloProgramaSvc.getActividadesMes(this.seccion, anio, mes).subscribe({
      next:  (actsCiclo) => this._doCrearCabecera(mes, anio, actsCiclo),
      error: ()          => this._doCrearCabecera(mes, anio, []),
    });
  }

  private _doCrearCabecera(mes: number, anio: number, actsCiclo: ActividadCiclo[]) {
    const actividadesIniciales = this._buildActividades(mes, anio, actsCiclo);
    const dto = {
      ...this.configForm.value,
      ...this._membresiaForm.value,
      altasBajas:            [],
      actividades:           actividadesIniciales,
      actividadesPendientes: this.actividadesPendientes.map((a, i) => ({ ...a, orden: i })),
      movimientos:           [],
      progresiones:          [],
    };
    this.svc.create(dto).subscribe({
      next: (inf) => {
        this.informeId = inf.id;
        this.actividades = actividadesIniciales;
        this.paso = 'tabs';
        this.creandoCabecera = false;
        this.loadInventario();
        const tieneCiclo = actsCiclo.length > 0;
        this.msg.add({
          severity: 'success',
          summary: 'Informe creado',
          detail: tieneCiclo
            ? `Actividades cargadas desde el ciclo de programa (${actsCiclo.length} sábados).`
            : 'Ya puedes llenar los datos por sección.',
        });
      },
      error: () => {
        this.creandoCabecera = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el informe.' });
      },
    });
  }

  // ── Inventario ───────────────────────────────────────────────────────────────
  loadInventario() {
    this.svc.getInventario(this.seccion).subscribe({
      next: (items) => this.inventario = items,
    });
  }

  abrirNuevoItem() {
    this.editingInvId = null;
    this.invForm.reset({ anioCompra: new Date().getFullYear(), cantidad: 1 });
    this.showInvDialog = true;
  }

  editarItem(item: InventarioItem) {
    this.editingInvId = item.id!;
    this.invForm.patchValue(item);
    this.showInvDialog = true;
  }

  guardarItem() {
    if (this.invForm.invalid) return;
    const dto: InventarioItem = { ...this.invForm.value, seccion: this.seccion };
    if (this.editingInvId) {
      this.svc.updateInventarioItem(this.editingInvId, dto).subscribe({
        next: (updated) => {
          const idx = this.inventario.findIndex(i => i.id === this.editingInvId);
          if (idx >= 0) this.inventario[idx] = updated;
          this.showInvDialog = false;
          this.msg.add({ severity: 'success', summary: 'Actualizado', detail: 'Artículo actualizado.' });
        },
      });
    } else {
      this.svc.createInventarioItem(dto).subscribe({
        next: (created) => {
          this.inventario.push(created);
          this.showInvDialog = false;
          this.msg.add({ severity: 'success', summary: 'Agregado', detail: 'Artículo agregado al inventario.' });
        },
      });
    }
  }

  eliminarItem(item: InventarioItem) {
    this.svc.deleteInventarioItem(item.id!).subscribe({
      next: () => {
        this.inventario = this.inventario.filter(i => i.id !== item.id);
        this.msg.add({ severity: 'success', summary: 'Eliminado', detail: 'Artículo eliminado.' });
      },
    });
  }

  // ── Alta/Baja ────────────────────────────────────────────────────────────────
  addAltaBaja(tipo: 'alta' | 'baja') {
    this.altasBajas.push({ tipo, cum: '', nombre: '', orden: this.altasBajas.length });
    this.triggerMembresia();
  }
  removeAltaBaja(i: number) { this.altasBajas.splice(i, 1); this.triggerMembresia(); }

  // ── Actividades ──────────────────────────────────────────────────────────────
  addActividad() {
    this.actividades.push({ fecha: '', actividad: '', asistencia: 0, asistentes: [], observaciones: '', orden: this.actividades.length });
    this.triggerActividades();
  }
  removeActividad(i: number) { this.actividades.splice(i, 1); this.triggerActividades(); }

  get promedioAsistencia(): number {
    const con = this.actividades.filter(a => a.asistencia > 0);
    if (!con.length) return 0;
    return Math.round(con.reduce((s, a) => s + Number(a.asistencia), 0) / con.length);
  }

  // ── Pendientes ───────────────────────────────────────────────────────────────
  addPendiente() {
    this.actividadesPendientes.push({ actividad: '', observaciones: '', orden: this.actividadesPendientes.length });
    this.triggerActividades();
  }
  removePendiente(i: number) { this.actividadesPendientes.splice(i, 1); this.triggerActividades(); }

  // ── Financiero ───────────────────────────────────────────────────────────────
  addIngreso() {
    this.ingresos.push({ tipo: 'ingreso', fecha: '', concepto: '', cantidad: 0, orden: this.ingresos.length });
    this.triggerFinanciero();
  }
  removeIngreso(i: number) { this.ingresos.splice(i, 1); this.triggerFinanciero(); }

  addEgreso() {
    this.egresos.push({ tipo: 'egreso', fecha: '', concepto: '', cantidad: 0, orden: this.egresos.length });
    this.triggerFinanciero();
  }
  removeEgreso(i: number) { this.egresos.splice(i, 1); this.triggerFinanciero(); }

  get totalIngresos(): number { return this.ingresos.reduce((s, m) => s + Number(m.cantidad), 0); }
  get totalEgresos(): number  { return this.egresos.reduce((s, m)  => s + Number(m.cantidad), 0); }
  get saldoActual(): number   { return Number(this.configForm.value.saldoInicial || 0) + this.totalIngresos - this.totalEgresos; }

  // ── Progresión ───────────────────────────────────────────────────────────────
  addProgresion() {
    this.progresiones.push({ descripcion: '', nombre: '', actividadNombre: '', fecha: '', orden: this.progresiones.length });
    this.triggerProgresion();
  }
  removeProgresion(i: number) { this.progresiones.splice(i, 1); this.triggerProgresion(); }

  private _buildDescripcionOpts(catalog: { ejeTematico: string; nombre: string }[]) {
    // ── Ejes Temáticos (se entrega el eje completo, no cada camino) ───────────
    const ejesGroup = {
      label: 'Ejes Temáticos',
      items: [
        { label: 'Salud y Bienestar',                value: 'Salud y Bienestar' },
        { label: 'Medio Ambiente',                   value: 'Medio Ambiente' },
        { label: 'Paz y Participación Comunitaria',  value: 'Paz y Participación Comunitaria' },
        { label: 'Habilidades para la Vida',         value: 'Habilidades para la Vida' },
      ],
    };

    // ── Senderos completos ────────────────────────────────────────────────────
    const senderosGroup = {
      label: 'Senderos',
      items: [
        { label: 'Sendero Cénit',   value: 'Sendero Cénit' },
        { label: 'Sendero Cima',    value: 'Sendero Cima' },
        { label: 'Sendero Cumbre',  value: 'Sendero Cumbre' },
        { label: 'Sendero Cúspide', value: 'Sendero Cúspide' },
      ],
    };

    // ── Aventuras en la Naturaleza ────────────────────────────────────────────
    const aventurasGroup = {
      label: 'Aventuras en la Naturaleza',
      items: [
        { label: 'Terra Nova',  value: 'Terra Nova' },
        { label: 'Kon-Tiki',    value: 'Kon-Tiki' },
        { label: '7 Cimas',     value: '7 Cimas' },
        { label: 'Discovery',   value: 'Discovery' },
      ],
    };

    // ── Iniciativas Mundiales ─────────────────────────────────────────────────
    const iniciativasGroup = {
      label: 'Iniciativas Mundiales',
      items: [
        { label: 'Mensajeros de la Paz',  value: 'Mensajeros de la Paz' },
        { label: 'Champions for Nature',  value: 'Champions for Nature' },
        { label: 'Plastic Tide Turners',  value: 'Plastic Tide Turners' },
        { label: 'Scouts Go Solar',       value: 'Scouts Go Solar' },
        { label: 'Acciones Humanitarias', value: 'Acciones Humanitarias' },
      ],
    };

    // ── Insignias Comunidad ───────────────────────────────────────────────────
    const insigniasGroup = {
      label: 'Insignias Comunidad',
      items: [
        { label: 'Insignia Obsidiana', value: 'Insignia Obsidiana' },
        { label: 'Insignia Jade',      value: 'Insignia Jade' },
        { label: 'Insignia Ópalo',     value: 'Insignia Ópalo' },
        { label: 'Insignia Diamante',  value: 'Insignia Diamante' },
        { label: 'Camisola',           value: 'Camisola' },
      ],
    };

    // ── Especialidades registradas en BD agrupadas por eje temático ───────────
    const areaMap = new Map<string, { label: string; value: string }[]>();
    for (const { ejeTematico, nombre } of catalog) {
      const area = ejeTematico || 'Especialidades';
      if (!areaMap.has(area)) areaMap.set(area, []);
      areaMap.get(area)!.push({ label: nombre, value: nombre });
    }
    const especialidadGroups = Array.from(areaMap.entries())
      .map(([area, items]) => ({ label: `Especialidades — ${area}`, items }));

    this.descripcionGroupedOpts = [
      ejesGroup,
      senderosGroup,
      aventurasGroup,
      iniciativasGroup,
      insigniasGroup,
      ...especialidadGroups,
    ];
  }

  get actividadOpts(): { label: string; value: string }[] {
    return this.actividades
      .filter(a => a.actividad)
      .map(a => ({ label: a.actividad + (a.fecha ? ' (' + a.fecha + ')' : ''), value: a.actividad }));
  }

  onProgresionActividadChange(p: ProgresionInforme, actividadNombre: string | null) {
    if (actividadNombre) {
      const act = this.actividades.find(a => a.actividad === actividadNombre);
      if (act?.fecha) {
        p.fecha = act.fecha;
      }
    }
    this.triggerProgresion();
  }

  // ── PDF ──────────────────────────────────────────────────────────────────────
  descargarPdf() {
    if (!this.informeId) return;
    this.generando = true;
    this.svc.downloadPdf(this.informeId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        const mes = MESES_NOMBRES[this.configForm.value.mes];
        a.href = url; a.download = `informe-${mes}-${this.configForm.value.anio}.pdf`; a.click();
        URL.revokeObjectURL(url);
        this.generando = false;
      },
      error: () => { this.generando = false; },
    });
  }

  cancelar() { this.router.navigate(['/informes']); }

  get titulo(): string { return this.informeId ? 'Editar Informe Mensual' : 'Nuevo Informe Mensual'; }
}
