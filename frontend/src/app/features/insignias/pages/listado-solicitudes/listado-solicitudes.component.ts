import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SolicitudesInsigniasService } from '../../../../core/services/solicitudes-insignias.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SolicitudInsignias } from '../../../../core/models/solicitud-insignias.model';

/**
 * Listado de solicitudes de insignias: tabla con caminante, fecha y número de
 * ítems, más las acciones de ver PDF, editar y borrar.
 */
@Component({
  selector: 'app-listado-solicitudes',
  templateUrl: './listado-solicitudes.component.html',
})
export class ListadoSolicitudesComponent implements OnInit {
  solicitudes: SolicitudInsignias[] = [];
  cargando = false;
  /** Id de la solicitud cuyo PDF se está generando, para el spinner del botón */
  descargando: number | null = null;

  constructor(
    public solicitudesService: SolicitudesInsigniasService,
    public authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * Trae las solicitudes. El backend ya filtra por sección según el rol de
   * quien consulta, así que aquí no se vuelve a filtrar.
   */
  cargar(): void {
    this.cargando = true;
    this.solicitudesService.getSolicitudes().subscribe({
      next: (datos) => {
        this.solicitudes = datos;
        this.cargando = false;
      },
      error: () => {
        this.solicitudes = [];
        this.cargando = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las solicitudes.',
        });
      },
    });
  }

  // ── Navegación ─────────────────────────────────────────────────────────────

  /** Alta de una solicitud nueva */
  nueva(): void {
    this.router.navigate(['/insignias/solicitudes/nueva']);
  }

  /** Edición de una solicitud existente */
  editar(solicitud: SolicitudInsignias): void {
    this.router.navigate(['/insignias/solicitudes', solicitud.id]);
  }

  // ── Acciones de fila ───────────────────────────────────────────────────────

  /**
   * Pide el PDF al backend y lo baja desde el Blob con un object URL temporal.
   * El revoke se difiere: revocarlo en el mismo tick corta la descarga en
   * algunos navegadores.
   */
  descargarPdf(solicitud: SolicitudInsignias): void {
    this.descargando = solicitud.id;
    this.solicitudesService.downloadPdf(solicitud.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `solicitud-insignias-${solicitud.id}.pdf`;
        enlace.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.descargando = null;
      },
      error: () => {
        this.descargando = null;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo generar el PDF de la solicitud.',
        });
      },
    });
  }

  /** Borrado con confirmación previa; las líneas caen por CASCADE en el backend */
  confirmarEliminar(solicitud: SolicitudInsignias): void {
    this.confirmationService.confirm({
      message: `¿Eliminar la solicitud de <strong>${this.nombreCaminante(solicitud)}</strong>?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.eliminar(solicitud),
    });
  }

  private eliminar(solicitud: SolicitudInsignias): void {
    this.solicitudesService.eliminarSolicitud(solicitud.id).subscribe({
      next: () => {
        this.solicitudes = this.solicitudes.filter((s) => s.id !== solicitud.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Eliminada',
          detail: 'La solicitud se eliminó correctamente.',
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar la solicitud.',
        });
      },
    });
  }

  // ── Utilidades de plantilla ────────────────────────────────────────────────

  /** Nombre completo del caminante; el backend siempre carga la relación */
  nombreCaminante(solicitud: SolicitudInsignias): string {
    const caminante = solicitud.caminante;
    if (!caminante) {
      return '—';
    }
    return `${caminante.nombre ?? ''} ${caminante.apellidos ?? ''}`.trim() || '—';
  }

  /** Número de líneas de la solicitud */
  numeroItems(solicitud: SolicitudInsignias): number {
    return solicitud.lineas?.length ?? 0;
  }
}
