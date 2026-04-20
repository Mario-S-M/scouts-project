import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CicloProgramaService } from '../../../../core/services/ciclo-programa.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ActividadCiclo, CicloPrograma, CrearCicloDto,
  EJES_TEMATICOS, MESES_NOMBRES, getSabadosDeCiclo, TipoCiclo,
} from '../../../../core/models/ciclo-programa.model';

interface ActividadForm extends ActividadCiclo {
  // local display
  fechaDisplay: string;
}

@Component({
  selector: 'app-crear-ciclo',
  templateUrl: './crear-ciclo.component.html',
  styleUrls: ['./crear-ciclo.component.scss'],
})
export class CrearCicloComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  actividades: ActividadForm[] = [];
  editId: number | null = null;
  loading           = false;
  guardando         = false;
  guardandoBorrador = false;
  generando         = false;
  autoGuardando     = false;
  ultimoGuardado: Date | null = null;

  private autoGuardeTrigger = new Subject<void>();
  private autoGuardeSub: Subscription | null = null;

  readonly ejesTematicos = EJES_TEMATICOS.map(e => ({ label: e, value: e }));
  readonly mesesOpts = MESES_NOMBRES.slice(1).map((m, i) => ({ label: m, value: i + 1 }));
  readonly tipoOpts = [
    { label: 'Trimestral (3 meses)',    value: 'trimestral' },
    { label: 'Cuatrimestral (4 meses)', value: 'cuatrimestral' },
  ];

  readonly anioOpts = (() => {
    const y = new Date().getFullYear();
    return [y - 1, y, y + 1, y + 2].map(n => ({ label: n.toString(), value: n }));
  })();

  // Wizard steps
  pasoActual = 1;

  constructor(
    private fb: FormBuilder,
    private svc: CicloProgramaService,
    private authService: AuthService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    const user = this.authService.getUser();
    const seccion = user ? this.authService.getSeccion(user.rol) : 'comunidad';

    this.form = this.fb.group({
      nombre:    ['', [Validators.required, Validators.minLength(3)]],
      mesInicio: [new Date().getMonth() + 1, Validators.required],
      anio:      [new Date().getFullYear(), Validators.required],
      tipo:      ['trimestral', Validators.required],
      seccion:   [seccion],
    });

    // Regenerate weekends when params change
    this.form.valueChanges.subscribe(() => {
      if (this.pasoActual === 1) this.generarSabados();
    });

    // Auto-save con debounce (solo en modo edición)
    this.autoGuardeSub = this.autoGuardeTrigger.pipe(
      debounceTime(1500),
    ).subscribe(() => {
      if (!this.editId || this.guardando || this.generando) return;
      this.autoGuardando = true;
      const dto = this.buildDto();
      this.svc.update(this.editId, dto).subscribe({
        next: () => {
          this.autoGuardando = false;
          this.ultimoGuardado = new Date();
        },
        error: () => {
          this.autoGuardando = false;
        },
      });
    });

    // If editing
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId = +id;
      this.loading = true;
      this.svc.getOne(this.editId).subscribe({
        next: (ciclo) => {
          this.form.patchValue({
            nombre:    ciclo.nombre,
            mesInicio: ciclo.mesInicio,
            anio:      ciclo.anio,
            tipo:      ciclo.tipo,
            seccion:   ciclo.seccion,
          });
          this.actividades = ciclo.actividades.map(a => ({
            ...a,
            fechaDisplay: this.fmtSabado(a.fechaSabado),
          }));
          this.loading = false;
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el ciclo.' });
          this.loading = false;
        },
      });
    } else {
      this.generarSabados();
    }
  }

  generarSabados() {
    const { mesInicio, anio, tipo } = this.form.value;
    if (!mesInicio || !anio || !tipo) return;

    const sabados = getSabadosDeCiclo(mesInicio, anio, tipo);

    // Preserve existing activity data if dates match
    const existing = new Map(this.actividades.map(a => [a.fechaSabado, a]));

    this.actividades = sabados.map((fecha, i) => {
      const prev = existing.get(fecha);
      return {
        fechaSabado:  fecha,
        fechaDisplay: this.fmtSabado(fecha),
        nombre:       prev?.nombre ?? '',
        ejeTematico:  prev?.ejeTematico ?? '',
        descripcion:  prev?.descripcion ?? '',
        orden:        i + 1,
      };
    });
  }

  siguientePaso() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.generarSabados();
    this.pasoActual = 2;
  }

  guardarBorrador() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.generarSabados();
    this.guardandoBorrador = true;
    const dto = this.buildDto();
    const obs = this.editId
      ? this.svc.update(this.editId, dto)
      : this.svc.create(dto);

    obs.subscribe({
      next: (ciclo) => {
        this.guardandoBorrador = false;
        this.messageService.add({ severity: 'success', summary: 'Guardado', detail: `Ciclo "${ciclo.nombre}" guardado. Puedes agregar actividades más tarde.` });
        this.router.navigate(['/ciclos-programa']);
      },
      error: () => {
        this.guardandoBorrador = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el ciclo.' });
      },
    });
  }

  anteriorPaso() {
    this.pasoActual = 1;
  }

  buildDto(): CrearCicloDto {
    const { nombre, mesInicio, anio, tipo, seccion } = this.form.value;
    return {
      nombre, mesInicio, anio, tipo, seccion,
      actividades: this.actividades.map(a => ({
        fechaSabado: a.fechaSabado,
        nombre:      a.nombre,
        ejeTematico: a.ejeTematico,
        descripcion: a.descripcion,
        orden:       a.orden,
      })),
    };
  }

  guardar() {
    this.guardando = true;
    const dto = this.buildDto();
    const obs = this.editId
      ? this.svc.update(this.editId, dto)
      : this.svc.create(dto);

    obs.subscribe({
      next: (ciclo) => {
        this.guardando = false;
        this.messageService.add({ severity: 'success', summary: 'Guardado', detail: `Ciclo "${ciclo.nombre}" guardado.` });
        this.router.navigate(['/ciclos-programa']);
      },
      error: () => {
        this.guardando = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el ciclo.' });
      },
    });
  }

  guardarYDescargar() {
    this.generando = true;
    const dto = this.buildDto();

    // First save, then download PDF
    const obs = this.editId
      ? this.svc.update(this.editId, dto)
      : this.svc.create(dto);

    obs.subscribe({
      next: (ciclo) => {
        this.svc.downloadPdf(ciclo.id).subscribe({
          next: (blob) => {
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = `ciclo-${ciclo.nombre.replace(/\s+/g, '-')}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            this.generando = false;
            this.router.navigate(['/ciclos-programa']);
          },
          error: () => {
            this.generando = false;
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el PDF.' });
          },
        });
      },
      error: () => {
        this.generando = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el ciclo.' });
      },
    });
  }

  ngOnDestroy() {
    this.autoGuardeSub?.unsubscribe();
  }

  onActividadChange() {
    if (this.editId) {
      this.autoGuardeTrigger.next();
    }
  }

  cancelar() {
    this.router.navigate(['/ciclos-programa']);
  }

  fmtSabado(iso: string): string {
    const d   = new Date(iso + 'T12:00:00');
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = MESES_NOMBRES[d.getMonth() + 1];
    const year = d.getFullYear();
    return `Sáb ${dia} ${mes} ${year}`;
  }

  get tituloPagina(): string {
    return this.editId ? 'Editar Ciclo de Programa' : 'Nuevo Ciclo de Programa';
  }

  get subtitulo(): string {
    const { mesInicio, anio, tipo } = this.form?.value ?? {};
    if (!mesInicio || !anio || !tipo) return '';
    const meses = tipo === 'trimestral' ? 3 : 4;
    const mesFin = ((mesInicio - 1 + meses) % 12) + 1;
    const anioFin = mesInicio + meses - 1 > 12 ? anio + 1 : anio;
    const label = mesFin < mesInicio
      ? `${MESES_NOMBRES[mesInicio]} ${anio} – ${MESES_NOMBRES[mesFin]} ${anioFin}`
      : `${MESES_NOMBRES[mesInicio]} – ${MESES_NOMBRES[mesFin]} ${anio}`;
    return `${label} · ${this.actividades.length} fines de semana`;
  }

  get pasoValido(): boolean {
    return this.form.valid;
  }

  get actividadesCompletas(): boolean {
    return this.actividades.every(a => !!a.nombre && !!a.ejeTematico);
  }
}
