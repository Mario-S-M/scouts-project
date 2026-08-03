import { Component, OnInit } from '@angular/core';
import { CalendarOptions, EventClickArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { forkJoin } from 'rxjs';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CalendarioService } from '../../../../core/services/calendario.service';
import { CicloProgramaService } from '../../../../core/services/ciclo-programa.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  Actividad, CrearActividadDto, SeccionActividad,
  SECCIONES_ACTIVIDAD, SECCION_COLOR,
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
  form: CrearActividadDto = { titulo: '', fecha: '', seccion: 'general' };

  dayDetailVisible = false;
  diaSeleccionado = '';
  eventosDelDia: ItemDia[] = [];

  readonly secciones = SECCIONES_ACTIVIDAD;
  seccionesPermitidas: SeccionActividad[] = [];

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

  calcularSeccionesPermitidas(): void {
    const user = this.auth.getUser();
    if (!user) { this.seccionesPermitidas = []; return; }
    if (user.rol === 'jefe_grupo' || user.rol === 'sub_jefe_grupo') {
      this.seccionesPermitidas = this.secciones.map((s) => s.value);
      return;
    }
    const seccion = this.auth.getSeccion(user.rol) as SeccionActividad;
    this.seccionesPermitidas = this.secciones.some((s) => s.value === seccion) ? [seccion] : [];
  }

  puedeCrear(): boolean {
    return this.seccionesPermitidas.length > 0;
  }

  puedeGestionar(a: Actividad): boolean {
    return this.seccionesPermitidas.includes(a.seccion);
  }

  getColor(seccion: SeccionActividad): string {
    return SECCION_COLOR[seccion];
  }

  cargar(): void {
    this.loading = true;
    forkJoin({
      actividades: this.svc.getAll(),
      ciclos: this.ciclosSvc.getAll(),
    }).subscribe({
      next: ({ actividades, ciclos }) => {
        this.actividades = actividades;
        this.ciclosActividades = ciclos.flatMap((c) =>
          c.actividades.map((a) => ({ ...a, seccion: c.seccion, cicloNombre: c.nombre })),
        );

        const eventosActividades: EventInput[] = actividades.map((a) => ({
          id: `actividad-${a.id}`,
          title: a.titulo,
          start: a.hora ? `${a.fecha}T${a.hora}` : a.fecha,
          allDay: !a.hora,
          backgroundColor: SECCION_COLOR[a.seccion],
          borderColor: SECCION_COLOR[a.seccion],
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
    return SECCION_COLOR[seccion as SeccionActividad] ?? '#9CA3AF';
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
        tipo: 'actividad', titulo: a.titulo, seccion: a.seccion,
        hora: a.hora, lugar: a.lugar, descripcion: a.descripcion, ref: a,
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
      this.editar(item.ref);
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
    if (actividad) this.editar(actividad);
  }

  nuevo(fecha?: string): void {
    this.dayDetailVisible = false;
    this.editando = null;
    this.form = {
      titulo: '',
      fecha: fecha ?? '',
      seccion: this.seccionesPermitidas.length === 1 ? this.seccionesPermitidas[0] : ('general' as SeccionActividad),
    };
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
      seccion: a.seccion,
    };
    this.dialogVisible = true;
  }

  guardar(): void {
    if (!this.form.titulo || !this.form.fecha || !this.form.seccion) return;
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
