import { Component, OnInit } from '@angular/core';
import { CalendarOptions, EventClickArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CalendarioService } from '../../../../core/services/calendario.service';
import { CicloProgramaService } from '../../../../core/services/ciclo-programa.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  Actividad, CrearActividadDto,
  SECCIONES_ACTIVIDAD, SECCION_COLOR, SECCIONES_MULTI, TIPOS_ACTIVIDAD, VISIBILIDADES,
} from '../../../../core/models/actividad.model';
import { ActividadCiclo } from '../../../../core/models/ciclo-programa.model';

interface ActividadCicloConSeccion extends ActividadCiclo {
  seccion: string;
  cicloNombre: string;
}

interface ItemDia {
  tipo: 'actividad' | 'ciclo-programa';
  titulo: string;
  seccion: string;
  hora?: string;
  lugar?: string;
  descripcion?: string;
  ejeTematico?: string;
  cicloNombre?: string;
  emoji?: string;
  seccionesLabel?: string;
  soloScouters?: boolean;
  ref?: Actividad;
}

@Component({
  selector: 'app-vista-calendario',
  templateUrl: './vista-calendario.component.html',
})
export class VistaCalendarioComponent implements OnInit {
  actividades: Actividad[] = [];
  ciclosActividades: ActividadCicloConSeccion[] = [];
  loading = false;
  guardando = false;

  dialogVisible = false;
  editando: Actividad | null = null;
  form: CrearActividadDto = this.formVacio();

  dayDetailVisible = false;
  diaSeleccionado = '';
  eventosDelDia: ItemDia[] = [];

  readonly secciones = SECCIONES_ACTIVIDAD;
  readonly tipos = TIPOS_ACTIVIDAD;
  readonly visibilidades = VISIBILIDADES;
  /** Opciones de secciones que este usuario puede asignar en el formulario */
  opcionesSecciones = SECCIONES_MULTI;
  readonly opcionesLeyenda = SECCIONES_MULTI;
  private rol = '';
  private seccionPropia: string | null = null;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locale: esLocale,
    height: 'auto',
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    events: [],
    dateClick: (info) => this.abrirDetalleDia(info.dateStr),
    eventClick: (info) => this.onEventClick(info),
  };

  constructor(
    private svc: CalendarioService,
    private ciclosSvc: CicloProgramaService,
    private auth: AuthService,
    private msg: MessageService,
    private confirm: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.calcularSeccionesPermitidas();
    this.cargar();
  }

  /**
   * Mismas reglas que el backend (actividad.service → puedeGestionar):
   * administrador todas; jefatura de grupo las de todo el grupo; cada scouter
   * las que son solo de su sección.
   */
  calcularSeccionesPermitidas(): void {
    const user = this.auth.getUser();
    this.rol = user?.rol ?? '';
    const s = user ? this.auth.getSeccion(user.rol) : '';
    this.seccionPropia = ['manada', 'tropa', 'comunidad', 'clan'].includes(s) ? s : null;
    if (this.rol === 'administrador') this.opcionesSecciones = SECCIONES_MULTI;
    else if (this.esJefaturaGrupo) this.opcionesSecciones = SECCIONES_MULTI.filter((o) => o.value === 'grupo');
    else this.opcionesSecciones = SECCIONES_MULTI.filter((o) => o.value === this.seccionPropia);
  }

  private get esJefaturaGrupo(): boolean {
    return ['jefe_grupo', 'sub_jefe_grupo'].includes(this.rol);
  }

  puedeCrear(): boolean {
    return this.rol === 'administrador' || this.esJefaturaGrupo || !!this.seccionPropia;
  }

  puedeGestionar(a: Actividad): boolean {
    const secs = a.secciones ?? [];
    if (this.rol === 'administrador') return true;
    if (this.esJefaturaGrupo) return secs.includes('grupo');
    return !!this.seccionPropia && secs.length > 0 && secs.every((x) => x === this.seccionPropia);
  }

  getColor(seccion: string): string {
    return SECCION_COLOR[seccion] ?? '#9CA3AF';
  }

  /** Color del evento: el de su sección, o morado si es de varias / todo el grupo */
  colorActividad(a: Actividad): string {
    const secs = a.secciones ?? [];
    return secs.length === 1 ? this.getColor(secs[0]) : SECCION_COLOR['grupo'];
  }

  emojiTipo(tipo?: string): string {
    return this.tipos.find((t) => t.value === tipo)?.emoji ?? '📌';
  }

  etiquetaSecciones(secs: string[] = []): string {
    return secs.map((x) => SECCIONES_MULTI.find((o) => o.value === x)?.label ?? x).join(' · ');
  }

  private formVacio(fecha = ''): CrearActividadDto {
    return { titulo: '', fecha, secciones: [], tipo: 'reunion', visibilidad: 'publica' };
  }

  /** El consejo es de scouters por defecto */
  onTipoChange(): void {
    if (this.form.tipo === 'consejo') this.form.visibilidad = 'scouters';
  }

  cargar(): void {
    this.loading = true;
    forkJoin({
      actividades: this.svc.getAll(),
      // Los jóvenes no listan ciclos de programa: sin eso el calendario se quedaba vacío
      ciclos: this.ciclosSvc.getAll().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ actividades, ciclos }) => {
        this.actividades = actividades;
        this.ciclosActividades = ciclos.flatMap((c) =>
          c.actividades.map((a) => ({ ...a, seccion: c.seccion, cicloNombre: c.nombre })),
        );

        const eventosActividades: EventInput[] = actividades.map((a) => ({
          id: `actividad-${a.id}`,
          title: `${this.emojiTipo(a.tipo)} ${a.visibilidad === 'scouters' ? '🔒 ' : ''}${a.titulo}`,
          start: a.hora ? `${a.fecha}T${a.hora}` : a.fecha,
          allDay: !a.hora,
          backgroundColor: this.colorActividad(a),
          borderColor: this.colorActividad(a),
          extendedProps: { tipo: 'actividad' },
        }));
        const eventosCiclos = this.mapearEventosCiclos();
        this.calendarOptions = {
          ...this.calendarOptions,
          events: [...eventosActividades, ...eventosCiclos],
        };
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  colorSeccion(seccion: string): string {
    return SECCION_COLOR[seccion] ?? '#9CA3AF';
  }

  private mapearEventosCiclos(): EventInput[] {
    return this.ciclosActividades.map((act) => {
      const color = this.colorSeccion(act.seccion);
      return {
        id: `ciclo-${act.id}`,
        title: `📘 ${act.nombre || act.cicloNombre}`,
        start: act.fechaSabado,
        allDay: true,
        editable: false,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          tipo: 'ciclo-programa',
          cicloNombre: act.cicloNombre,
          seccion: act.seccion,
          ejeTematico: act.ejeTematico,
          descripcion: act.descripcion,
        },
      };
    });
  }

  abrirDetalleDia(fecha: string): void {
    this.diaSeleccionado = fecha;

    const deActividades: ItemDia[] = this.actividades
      .filter((a) => a.fecha === fecha)
      .map((a) => ({
        tipo: 'actividad', titulo: a.titulo, seccion: (a.secciones ?? [])[0] ?? a.seccion,
        hora: a.hora, lugar: a.lugar, descripcion: a.descripcion, ref: a,
        emoji: this.emojiTipo(a.tipo), seccionesLabel: this.etiquetaSecciones(a.secciones),
        soloScouters: a.visibilidad === 'scouters',
      }));

    const deCiclos: ItemDia[] = this.ciclosActividades
      .filter((a) => a.fechaSabado === fecha)
      .map((a) => ({
        tipo: 'ciclo-programa', titulo: a.nombre || a.cicloNombre, seccion: a.seccion,
        descripcion: a.descripcion, ejeTematico: a.ejeTematico, cicloNombre: a.cicloNombre,
      }));

    this.eventosDelDia = [...deActividades, ...deCiclos].sort((a, b) => a.seccion.localeCompare(b.seccion));
    this.dayDetailVisible = true;
  }

  seccionLabel(seccion: string): string {
    return this.secciones.find((s) => s.value === seccion)?.label ?? seccion;
  }

  abrirItemDia(item: ItemDia): void {
    if (item.tipo === 'ciclo-programa') {
      this.msg.add({
        severity: 'info',
        summary: item.cicloNombre ?? 'Ciclo de Programa',
        detail: `${item.ejeTematico ?? ''}${item.descripcion ? ' — ' + item.descripcion : ''}\nEdítala desde "Ciclo de Programa".`,
      });
      return;
    }
    if (item.ref) {
      this.dayDetailVisible = false;
      this.abrirActividad(item.ref);
    }
  }

  onEventClick(info: EventClickArg): void {
    const props = info.event.extendedProps as { tipo: string; cicloNombre?: string; seccion?: string; ejeTematico?: string; descripcion?: string };

    if (props.tipo === 'ciclo-programa') {
      this.msg.add({
        severity: 'info',
        summary: props.cicloNombre ?? 'Ciclo de Programa',
        detail: `${props.ejeTematico ?? ''}${props.descripcion ? ' — ' + props.descripcion : ''}\nEdítala desde "Ciclo de Programa".`,
      });
      return;
    }

    const id = Number(info.event.id.replace('actividad-', ''));
    const actividad = this.actividades.find((a) => a.id === id);
    if (actividad) this.abrirActividad(actividad);
  }

  /** Edita si puede; si no, solo muestra el detalle */
  private abrirActividad(a: Actividad): void {
    if (this.puedeGestionar(a)) { this.editar(a); return; }
    this.msg.add({
      severity: 'info',
      summary: `${this.emojiTipo(a.tipo)} ${a.titulo}`,
      detail: [this.etiquetaSecciones(a.secciones), a.hora?.slice(0, 5), a.lugar, a.descripcion].filter(Boolean).join(' · '),
    });
  }

  nuevo(fecha?: string): void {
    this.dayDetailVisible = false;
    this.editando = null;
    this.form = this.formVacio(fecha ?? '');
    // Si solo puede una opción (su sección o todo el grupo), queda puesta
    if (this.opcionesSecciones.length === 1) this.form.secciones = [this.opcionesSecciones[0].value];
    this.dialogVisible = true;
  }

  editar(a: Actividad): void {
    this.editando = a;
    this.form = {
      titulo: a.titulo,
      descripcion: a.descripcion,
      fecha: a.fecha,
      hora: a.hora ? a.hora.slice(0, 5) : undefined,
      lugar: a.lugar,
      secciones: [...(a.secciones ?? [])],
      tipo: a.tipo ?? 'reunion',
      visibilidad: a.visibilidad ?? 'publica',
    };
    this.dialogVisible = true;
  }

  guardar(): void {
    if (!this.form.titulo || !this.form.fecha || !this.form.secciones?.length) return;
    // "Todo el grupo" sustituye a cualquier otra sección marcada
    if (this.form.secciones.includes('grupo')) this.form.secciones = ['grupo'];
    this.guardando = true;
    const obs = this.editando
      ? this.svc.update(this.editando.id, this.form)
      : this.svc.create(this.form);
    obs.subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: 'Actividad guardada.' });
        this.dialogVisible = false;
        this.guardando = false;
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.msg.add({
          severity: 'error', summary: 'Error',
          detail: err?.error?.message ?? 'No se pudo guardar la actividad.',
        });
      },
    });
  }

  eliminar(): void {
    if (!this.editando) return;
    const id = this.editando.id;
    const titulo = this.editando.titulo;
    this.confirm.confirm({
      message: `¿Eliminar la actividad "${titulo}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.svc.delete(id).subscribe({
          next: () => {
            this.dialogVisible = false;
            this.msg.add({ severity: 'success', summary: 'Eliminada', detail: 'Actividad eliminada.' });
            this.cargar();
          },
          error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.' }),
        });
      },
    });
  }
}
