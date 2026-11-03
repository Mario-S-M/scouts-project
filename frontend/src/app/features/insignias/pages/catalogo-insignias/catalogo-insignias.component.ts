import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SolicitudesInsigniasService } from '../../../../core/services/solicitudes-insignias.service';
import {
  CatalogoInsignia,
  CategoriaCatalogo,
  CATEGORIAS_CATALOGO,
  CATEGORIA_LABEL,
  CrearCatalogoInsigniaDto,
} from '../../../../core/models/solicitud-insignias.model';

/** Opción del desplegable de categorías */
interface OpcionCategoria {
  label: string;
  value: CategoriaCatalogo;
}

/** Datos que se capturan en el diálogo de alta y edición */
interface FormularioCatalogo {
  categoria: CategoriaCatalogo | null;
  nombre: string;
  descripcion: string;
  claveProgreso: string;
  orden: number;
  activo: boolean;
}

/**
 * Administración del catálogo de ítems solicitables: tabla del catálogo y
 * diálogo de alta y edición. El borrado es lógico (activo = false).
 */
@Component({
  selector: 'app-catalogo-insignias',
  templateUrl: './catalogo-insignias.component.html',
})
export class CatalogoInsigniasComponent implements OnInit {
  /** Catálogo tal como llega del backend */
  items: CatalogoInsignia[] = [];
  /** Lo que realmente pinta la tabla: ordenado y filtrado por categoría */
  itemsFiltrados: CatalogoInsignia[] = [];

  cargando = false;
  guardando = false;

  /** Interruptor para ver también los ítems dados de baja */
  mostrarInactivos = false;

  /** Filtro de categoría de la tabla; null significa "todas" */
  categoriaFiltro: CategoriaCatalogo | null = null;

  // ── Diálogo ────────────────────────────────────────────────────────────────

  dialogoVisible = false;
  /** Ítem que se está editando; null cuando es un alta */
  itemEnEdicion: CatalogoInsignia | null = null;
  formulario: FormularioCatalogo = this.formularioVacio();

  /** Etiquetas legibles de las categorías, compartidas con la plantilla */
  readonly categoriaLabel = CATEGORIA_LABEL;

  /** Las seis categorías del enum del backend, para el desplegable */
  readonly opcionesCategoria: OpcionCategoria[] = CATEGORIAS_CATALOGO.map(
    (categoria) => ({ label: CATEGORIA_LABEL[categoria], value: categoria }),
  );

  /** Mismas opciones más "Todas", para el filtro de la tabla */
  readonly opcionesFiltro: { label: string; value: CategoriaCatalogo | null }[] = [
    { label: 'Todas las categorías', value: null },
    ...CATEGORIAS_CATALOGO.map((categoria) => ({
      label: CATEGORIA_LABEL[categoria],
      value: categoria as CategoriaCatalogo | null,
    })),
  ];

  constructor(
    public solicitudesService: SolicitudesInsigniasService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  // ── Carga y filtrado ───────────────────────────────────────────────────────

  /** Trae el catálogo del backend respetando el interruptor de inactivos */
  cargar(): void {
    this.cargando = true;
    this.solicitudesService.getCatalogo(this.mostrarInactivos).subscribe({
      next: (items) => {
        this.items = items;
        this.aplicarFiltro();
        this.cargando = false;
      },
      error: (err: HttpErrorResponse) => {
        this.cargando = false;
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo cargar el catálogo',
          detail: this.mensajeDeError(err, 'Intenta de nuevo en un momento.'),
        });
      },
    });
  }

  /**
   * Ordena por categoría (en el orden de CATEGORIAS_CATALOGO, no el alfabético
   * que devuelve el backend) y luego por orden y nombre, y aplica el filtro.
   * La agrupación por subencabezado de p-table depende de este orden.
   */
  aplicarFiltro(): void {
    const visibles = this.categoriaFiltro
      ? this.items.filter((item) => item.categoria === this.categoriaFiltro)
      : [...this.items];

    this.itemsFiltrados = visibles.sort((a, b) => {
      const porCategoria =
        CATEGORIAS_CATALOGO.indexOf(a.categoria) -
        CATEGORIAS_CATALOGO.indexOf(b.categoria);
      if (porCategoria !== 0) return porCategoria;

      const porOrden = (a.orden ?? 0) - (b.orden ?? 0);
      if (porOrden !== 0) return porOrden;

      return a.nombre.localeCompare(b.nombre);
    });
  }

  /** Cuántos ítems activos hay entre los cargados */
  get totalActivos(): number {
    return this.items.filter((item) => item.activo).length;
  }

  // ── Diálogo de alta y edición ──────────────────────────────────────────────

  /** Abre el diálogo en blanco para dar de alta un ítem */
  nuevo(): void {
    this.itemEnEdicion = null;
    this.formulario = this.formularioVacio();
    this.dialogoVisible = true;
  }

  /** Abre el diálogo con los datos del ítem seleccionado */
  editar(item: CatalogoInsignia): void {
    this.itemEnEdicion = item;
    this.formulario = {
      categoria: item.categoria,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      claveProgreso: item.claveProgreso ?? '',
      orden: item.orden ?? 0,
      activo: item.activo,
    };
    this.dialogoVisible = true;
  }

  /** Cierra el diálogo sin guardar */
  cancelar(): void {
    this.dialogoVisible = false;
  }

  /** Al ocultarse el diálogo se limpia el formulario para la próxima vez */
  alCerrarDialogo(): void {
    this.itemEnEdicion = null;
    this.formulario = this.formularioVacio();
    this.guardando = false;
  }

  /** El botón de guardar solo se habilita con categoría y nombre */
  get formularioValido(): boolean {
    return !!this.formulario.categoria && this.formulario.nombre.trim().length > 0;
  }

  /** Alta o edición según se haya abierto el diálogo con un ítem o sin él */
  guardar(): void {
    if (!this.formularioValido || this.guardando) return;

    // Se arma el payload campo por campo: nunca se manda la fila entera,
    // que llevaría el id y otros campos que el DTO no espera
    const dto: CrearCatalogoInsigniaDto = {
      categoria: this.formulario.categoria as CategoriaCatalogo,
      nombre: this.formulario.nombre.trim(),
      descripcion: this.formulario.descripcion.trim() || null,
      claveProgreso: this.formulario.claveProgreso.trim() || null,
      orden: this.formulario.orden ?? 0,
      activo: this.formulario.activo,
    };

    this.guardando = true;

    const peticion = this.itemEnEdicion
      ? this.solicitudesService.actualizarCatalogoItem(this.itemEnEdicion.id, dto)
      : this.solicitudesService.crearCatalogoItem(dto);

    const eraAlta = !this.itemEnEdicion;

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.dialogoVisible = false;
        this.messageService.add({
          severity: 'success',
          summary: eraAlta ? 'Ítem creado' : 'Ítem actualizado',
          detail: `"${dto.nombre}" quedó guardado en el catálogo.`,
        });
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        // El diálogo se queda abierto para que se pueda corregir el dato
        this.guardando = false;

        if (err.status === 409) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Nombre duplicado',
            // Se prefiere el texto propio: el del backend trae la clave del
            // enum (cinta_comunidad) en vez de la etiqueta legible
            detail:
              `Ya existe un ítem llamado "${dto.nombre}" en la categoría ` +
              `${CATEGORIA_LABEL[dto.categoria]}. Usa otro nombre.`,
          });
          return;
        }

        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo guardar',
          detail: this.mensajeDeError(err, 'Revisa los datos e intenta de nuevo.'),
        });
      },
    });
  }

  // ── Borrado lógico ─────────────────────────────────────────────────────────

  /**
   * Pide confirmación dejando claro que el ítem se desactiva, no se elimina:
   * las solicitudes históricas lo siguen mostrando.
   */
  confirmarBorrado(item: CatalogoInsignia): void {
    this.confirmationService.confirm({
      key: 'catalogoInsignias',
      header: 'Desactivar ítem del catálogo',
      message:
        `"${item.nombre}" dejará de aparecer al armar nuevas solicitudes. ` +
        'Es un borrado lógico: el ítem se desactiva y las solicitudes ya ' +
        'guardadas lo conservan tal cual. Puedes volver a activarlo editándolo.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-text p-button-sm',
      accept: () => this.desactivar(item),
    });
  }

  /** Llama al borrado lógico del backend */
  private desactivar(item: CatalogoInsignia): void {
    this.solicitudesService.eliminarCatalogoItem(item.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Ítem desactivado',
          detail: `"${item.nombre}" ya no se ofrece en solicitudes nuevas.`,
        });
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo desactivar',
          detail: this.mensajeDeError(err, 'Intenta de nuevo en un momento.'),
        });
      },
    });
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  /** Formulario en blanco para un alta */
  private formularioVacio(): FormularioCatalogo {
    return {
      categoria: null,
      nombre: '',
      descripcion: '',
      claveProgreso: '',
      orden: 0,
      activo: true,
    };
  }

  /**
   * Nest devuelve `message` como cadena en los 4xx de negocio y como arreglo
   * en los 400 del ValidationPipe; aquí se normalizan los dos casos.
   */
  private mensajeDeError(err: HttpErrorResponse, porDefecto: string): string {
    const mensaje = err?.error?.message;
    if (Array.isArray(mensaje)) return mensaje.join('. ');
    if (typeof mensaje === 'string' && mensaje.trim()) return mensaje;
    return porDefecto;
  }
}
