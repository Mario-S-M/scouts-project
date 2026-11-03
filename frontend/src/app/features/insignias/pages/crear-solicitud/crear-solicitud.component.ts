import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { SolicitudesInsigniasService } from '../../../../core/services/solicitudes-insignias.service';
import { CaminanteService } from '../../../../core/services/caminante.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Caminante } from '../../../../core/models/caminante.model';
import {
  CatalogoInsignia,
  CategoriaCatalogo,
  CATEGORIAS_CATALOGO,
  CATEGORIA_LABEL,
  ComponenteKit,
  COMPONENTES_KIT,
  COMPONENTES_KIT_DEFAULT,
  COMPONENTE_KIT_LABEL,
  COMPONENTE_KIT_OBLIGATORIO,
  CrearSolicitudInsigniasDto,
  LineaSolicitudInsigniasDto,
  SolicitudInsignias,
} from '../../../../core/models/solicitud-insignias.model';

/** Un bloque de la pantalla: una categoría del catálogo con sus ítems */
interface GrupoCatalogo {
  categoria: CategoriaCatalogo;
  label: string;
  items: CatalogoInsignia[];
}

/** Opción del selector de caminante */
interface OpcionCaminante {
  label: string;
  value: number;
}

/**
 * Alta y edición de una solicitud: selector de caminante, fecha, observaciones
 * y selección de ítems agrupada por categoría, con las sugerencias premarcadas.
 */
@Component({
  selector: 'app-crear-solicitud',
  templateUrl: './crear-solicitud.component.html',
  styleUrls: ['./crear-solicitud.component.scss'],
})
export class CrearSolicitudComponent implements OnInit {
  /** Id de la solicitud cuando se está editando; null en el alta */
  solicitudId: number | null = null;
  catalogo: CatalogoInsignia[] = [];
  cargando = false;
  guardando = false;
  /** El preview del PDF tiene su propio indicador para no bloquear Guardar */
  generandoPreview = false;

  /** Datos de cabecera: caminante, fecha y observaciones */
  form: FormGroup;

  /** Ítems del catálogo agrupados por categoría, en el orden de la spec */
  grupos: GrupoCatalogo[] = [];

  /** Scouts que puede elegir el usuario, ya filtrados por su sección */
  caminantesOpts: OpcionCaminante[] = [];

  /** catalogoItemId → ¿está seleccionado? */
  seleccion: Record<number, boolean> = {};
  /** catalogoItemId → cantidad pedida */
  cantidades: Record<number, number> = {};
  /** catalogoItemId de kit → qué componentes lleva */
  kitPorItem: Record<number, Record<ComponenteKit, boolean>> = {};

  /** Lista fija de componentes del kit, para recorrerla en la plantilla */
  readonly componentesKit = COMPONENTES_KIT;
  /** Componente del kit que nunca se puede desmarcar */
  readonly componenteObligatorio = COMPONENTE_KIT_OBLIGATORIO;

  constructor(
    public solicitudesService: SolicitudesInsigniasService,
    public caminanteService: CaminanteService,
    public authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      caminanteId: [null as number | null, Validators.required],
      fecha: [new Date(), Validators.required],
      observaciones: [''],
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.solicitudId = idParam ? Number(idParam) : null;
    this.cargarDatos();
  }

  // ── Carga inicial ──────────────────────────────────────────────────────────

  /**
   * Catálogo y caminantes primero; en edición, la solicitud después, para que
   * al aplicar sus líneas ya se conozca la categoría de cada ítem.
   * En edición se piden también los ítems inactivos: una solicitud vieja puede
   * apuntar a un ítem dado de baja y esa línea no debe desaparecer al guardar.
   */
  private cargarDatos(): void {
    this.cargando = true;
    const esEdicion = this.solicitudId !== null;

    forkJoin({
      catalogo: this.solicitudesService.getCatalogo(esEdicion),
      caminantes: this.caminanteService.getAll(),
    }).subscribe({
      next: ({ catalogo, caminantes }) => {
        this.catalogo = catalogo;
        this.caminantesOpts = this.filtrarPorSeccion(caminantes).map((c) => ({
          label: this.nombreCompleto(c),
          value: c.id,
        }));

        if (this.solicitudId !== null) {
          this.cargarSolicitud(this.solicitudId);
        } else {
          this.construirGrupos();
          this.cargando = false;
        }
      },
      error: () => {
        this.cargando = false;
        this.avisoError('No se pudo cargar el catálogo de insignias');
      },
    });
  }

  /** Trae la solicitud a editar y vuelca sus datos en el formulario */
  private cargarSolicitud(id: number): void {
    this.solicitudesService.getSolicitud(id).subscribe({
      next: (solicitud) => {
        this.aplicarSolicitud(solicitud);
        this.construirGrupos();
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.avisoError('No se pudo cargar la solicitud');
      },
    });
  }

  /** Vuelca cabecera y líneas de una solicitud guardada en el formulario */
  private aplicarSolicitud(solicitud: SolicitudInsignias): void {
    this.form.patchValue({
      caminanteId: solicitud.caminanteId,
      fecha: this.aFecha(solicitud.fecha),
      observaciones: solicitud.observaciones ?? '',
    });

    // El caminante de la solicitud puede quedar fuera del filtro por sección
    // (por ejemplo si la creó un rol de grupo); se añade para que el selector
    // no se vea vacío al abrir la edición.
    const yaEsta = this.caminantesOpts.some((o) => o.value === solicitud.caminanteId);
    if (!yaEsta) {
      this.caminantesOpts = [
        {
          label: solicitud.caminante
            ? this.nombreCompleto(solicitud.caminante)
            : `Caminante #${solicitud.caminanteId}`,
          value: solicitud.caminanteId,
        },
        ...this.caminantesOpts,
      ];
    }

    this.seleccion = {};
    this.cantidades = {};
    this.kitPorItem = {};

    for (const linea of solicitud.lineas || []) {
      const itemId = linea.catalogoItemId;
      this.seleccion[itemId] = true;
      this.cantidades[itemId] = linea.cantidad || 1;
      if (linea.componentesKit) {
        this.kitPorItem[itemId] = this.mapaComponentes(linea.componentesKit);
      }
    }
  }

  /**
   * Arma los bloques por categoría. Un ítem inactivo solo se muestra si la
   * solicitud que se está editando ya lo tenía seleccionado.
   */
  private construirGrupos(): void {
    this.grupos = CATEGORIAS_CATALOGO.map((categoria) => ({
      categoria,
      label: CATEGORIA_LABEL[categoria],
      items: this.catalogo
        .filter((i) => i.categoria === categoria)
        .filter((i) => i.activo || this.seleccion[i.id])
        .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
    })).filter((g) => g.items.length > 0);
  }

  /**
   * Solo los scouts de la sección del usuario. Los roles de grupo no tienen
   * sección propia ('grupo') y ven a todos los caminantes.
   */
  private filtrarPorSeccion(caminantes: Caminante[]): Caminante[] {
    const rol = this.authService.getUser()?.rol ?? '';
    const seccion = this.authService.getSeccion(rol);
    if (!seccion || seccion === 'grupo') {
      return caminantes;
    }
    return caminantes.filter((c) => c.seccion === seccion);
  }

  // ── Selección de ítems ─────────────────────────────────────────────────────

  /** Al elegir caminante se reinicia la selección y se premarcan sugerencias */
  onCaminanteChange(): void {
    const caminanteId = this.form.value.caminanteId as number | null;
    this.seleccion = {};
    this.cantidades = {};
    this.kitPorItem = {};
    this.construirGrupos();

    if (!caminanteId) {
      return;
    }

    this.solicitudesService.getSugerencias(caminanteId).subscribe({
      next: (ids) => {
        for (const id of ids || []) {
          this.marcarItem(id, true);
        }
        this.construirGrupos();
        if (ids && ids.length) {
          this.messageService.add({
            severity: 'info',
            summary: 'Sugerencias',
            detail: `Se premarcaron ${ids.length} insignia(s) según el progreso registrado. Puedes desmarcarlas.`,
          });
        }
      },
      // Las sugerencias son una ayuda: si fallan, el alta manual sigue viva
      error: () =>
        this.messageService.add({
          severity: 'warn',
          summary: 'Sugerencias no disponibles',
          detail: 'Marca los ítems manualmente',
        }),
    });
  }

  /** Marca o desmarca un ítem, inicializando cantidad y kit la primera vez */
  private marcarItem(itemId: number, valor: boolean): void {
    this.seleccion[itemId] = valor;
    if (!valor) {
      return;
    }
    if (!this.cantidades[itemId]) {
      this.cantidades[itemId] = 1;
    }
    if (this.esKit(itemId) && !this.kitPorItem[itemId]) {
      this.kitPorItem[itemId] = this.mapaComponentes(COMPONENTES_KIT_DEFAULT);
    }
  }

  /** Handler del checkbox de cada ítem del catálogo */
  onItemToggle(item: CatalogoInsignia): void {
    this.marcarItem(item.id, !!this.seleccion[item.id]);
  }

  /** ¿El ítem del catálogo es el kit de pañoleta? */
  private esKit(itemId: number): boolean {
    return this.catalogo.some(
      (i) => i.id === itemId && i.categoria === 'kit_panoleta',
    );
  }

  /** Estado de las casillas del kit de un ítem, creándolo si aún no existe */
  kitDe(itemId: number): Record<ComponenteKit, boolean> {
    if (!this.kitPorItem[itemId]) {
      this.kitPorItem[itemId] = this.mapaComponentes(COMPONENTES_KIT_DEFAULT);
    }
    return this.kitPorItem[itemId];
  }

  /** Las motas van siempre: su casilla se pinta marcada y deshabilitada */
  esComponenteObligatorio(componente: ComponenteKit): boolean {
    return componente === COMPONENTE_KIT_OBLIGATORIO;
  }

  /**
   * Etiqueta legible del componente. Se toma la del modelo y solo el sector
   * lleva aclaración, porque en el uniforme es el parche que dice "Michoacán".
   */
  etiquetaComponente(componente: ComponenteKit): string {
    if (componente === 'sector') {
      return 'Sector (Michoacán)';
    }
    return COMPONENTE_KIT_LABEL[componente];
  }

  /** Convierte una lista de componentes en el mapa de casillas del formulario */
  private mapaComponentes(componentes: ComponenteKit[]): Record<ComponenteKit, boolean> {
    const mapa = {} as Record<ComponenteKit, boolean>;
    for (const comp of COMPONENTES_KIT) {
      mapa[comp] = componentes.includes(comp);
    }
    // Las motas nunca se pueden quitar, venga como venga el dato guardado
    mapa[COMPONENTE_KIT_OBLIGATORIO] = true;
    return mapa;
  }

  /** Cuántos ítems lleva la solicitud; sirve para habilitar los botones */
  get totalSeleccionados(): number {
    return Object.keys(this.seleccion).filter((id) => this.seleccion[+id]).length;
  }

  /** No se puede guardar ni previsualizar sin caminante o sin ítems */
  get formularioIncompleto(): boolean {
    return this.form.invalid || this.totalSeleccionados === 0;
  }

  // ── Guardado y PDF ─────────────────────────────────────────────────────────

  /** Arma el DTO que viaja al backend a partir del estado de la pantalla */
  private construirDto(): CrearSolicitudInsigniasDto {
    const lineas: LineaSolicitudInsigniasDto[] = [];

    for (const item of this.catalogo) {
      if (!this.seleccion[item.id]) {
        continue;
      }
      const cantidad = this.cantidades[item.id];
      const linea: LineaSolicitudInsigniasDto = {
        catalogoItemId: item.id,
        cantidad: cantidad && cantidad > 0 ? cantidad : 1,
      };
      if (item.categoria === 'kit_panoleta') {
        const mapa = this.kitDe(item.id);
        // Se fuerza 'motas': el backend rechaza con 400 la línea que no la trae
        linea.componentesKit = COMPONENTES_KIT.filter(
          (c) => mapa[c] || c === COMPONENTE_KIT_OBLIGATORIO,
        );
      }
      lineas.push(linea);
    }

    return {
      caminanteId: this.form.value.caminanteId,
      fecha: this.aIso(this.form.value.fecha),
      // Cadena vacía y no undefined: en edición el DTO es un PartialType y un
      // undefined significa "no tocar", así que no se podrían borrar las notas
      observaciones: this.form.value.observaciones ?? '',
      lineas,
    };
  }

  /** Guarda el alta o la edición y regresa al listado */
  guardar(): void {
    if (this.formularioIncompleto || this.guardando) {
      return;
    }
    this.guardando = true;
    const dto = this.construirDto();
    const peticion =
      this.solicitudId !== null
        ? this.solicitudesService.actualizarSolicitud(this.solicitudId, dto)
        : this.solicitudesService.crearSolicitud(dto);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.messageService.add({
          severity: 'success',
          summary: this.solicitudId !== null ? 'Solicitud actualizada' : 'Solicitud creada',
          detail: 'El pedido quedó registrado',
        });
        this.router.navigate(['/insignias/solicitudes']);
      },
      error: (err) => {
        this.guardando = false;
        this.avisoError(err?.error?.message || 'No se pudo guardar la solicitud');
      },
    });
  }

  /**
   * Previsualiza el PDF sin guardar. La pestaña se abre de inmediato —antes de
   * la respuesta— o el navegador la bloquea por no venir de un clic.
   */
  previsualizarPdf(): void {
    if (this.formularioIncompleto || this.generandoPreview) {
      return;
    }
    const ventana = window.open('', '_blank');
    if (!ventana) {
      this.avisoError('El navegador bloqueó la ventana emergente del PDF');
      return;
    }

    this.generandoPreview = true;
    this.solicitudesService.previewPdf(this.construirDto()).subscribe({
      next: (blob) => {
        this.generandoPreview = false;
        ventana.location.href = URL.createObjectURL(blob);
      },
      error: () => {
        this.generandoPreview = false;
        ventana.close();
        this.avisoError('No se pudo generar la previsualización del PDF');
      },
    });
  }

  /** Vuelve al listado sin guardar */
  cancelar(): void {
    this.router.navigate(['/insignias/solicitudes']);
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  /** Nombre y apellidos en una sola cadena */
  private nombreCompleto(persona: { nombre?: string; apellidos?: string }): string {
    return `${persona.nombre ?? ''} ${persona.apellidos ?? ''}`.trim();
  }

  /**
   * 'YYYY-MM-DD' → Date local. new Date('2026-09-22') se interpreta en UTC y
   * en México se vería como el día anterior, así que se arma por partes.
   */
  private aFecha(iso: string): Date {
    if (!iso) {
      return new Date();
    }
    const [anio, mes, dia] = iso.substring(0, 10).split('-').map(Number);
    return new Date(anio, (mes || 1) - 1, dia || 1);
  }

  /** Date local → 'YYYY-MM-DD', sin pasar por UTC */
  private aIso(fecha: Date | string | null): string {
    if (!fecha) {
      return this.aIso(new Date());
    }
    if (typeof fecha === 'string') {
      return fecha.substring(0, 10);
    }
    const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
    const dia = `${fecha.getDate()}`.padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  /** Toast de error, siempre con el mismo formato */
  private avisoError(detalle: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: detalle,
    });
  }
}
