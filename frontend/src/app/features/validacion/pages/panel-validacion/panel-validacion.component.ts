import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MessageService } from 'primeng/api';
import { EvidenciaService } from '../../../../core/services/evidencia.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Evidencia } from '../../../../core/models/evidencia.model';

@Component({
  selector: 'app-panel-validacion',
  templateUrl: './panel-validacion.component.html',
})
export class PanelValidacionComponent implements OnInit {
  evidencias: Evidencia[] = [];
  loading = true;

  selectedEvidencia: Evidencia = null;
  showDialog = false;
  validadoPor = '';
  comentario = '';
  processing = false;

  filterEstado = 'pendiente';
  estadoOptions = [
    { label: 'Pendientes', value: 'pendiente' },
    { label: 'Aprobadas', value: 'aprobada' },
    { label: 'Rechazadas', value: 'rechazada' },
    { label: 'Todas', value: '' },
  ];

  tipoLabels = {
    sendero: 'Sendero',
    especialidad: 'Especialidad',
    aventura: 'Aventura',
    iniciativa: 'Iniciativa',
    evento: 'Evento',
    puntaDeFlecha: 'Punta de Flecha',
  };

  etapaLabels = {
    conozco: 'Conozco',
    aplico: 'Aplico',
    comparto: 'Comparto',
    participacion: 'Participación',
    certificacion: 'Certificación',
  };

  constructor(
    private evidenciaService: EvidenciaService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private messageService: MessageService,
  ) {}

  ngOnInit() {
    this.loadEvidencias();
  }

  loadEvidencias() {
    this.loading = true;
    this.evidenciaService.getAll().subscribe({
      next: (data) => {
        this.evidencias = data;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  get filteredEvidencias() {
    if (!this.filterEstado) return this.evidencias;
    return this.evidencias.filter((e) => e.estado === this.filterEstado);
  }

  openDialog(ev: Evidencia) {
    this.selectedEvidencia = ev;
    this.comentario = '';
    this.validadoPor = this.authService.getUser()?.nombre ?? '';
    this.showDialog = true;
  }

  closeDialog() {
    this.showDialog = false;
    this.selectedEvidencia = null;
  }

  aprobar() {
    if (!this.selectedEvidencia) return;
    this.processing = true;
    this.evidenciaService.validar(this.selectedEvidencia.id, {
      estado: 'aprobada',
      comentarioValidador: this.comentario,
      validadoPor: this.validadoPor || 'Validador',
    }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Aprobada',
          detail: 'La evidencia ha sido aprobada y el progreso actualizado.',
        });
        this.processing = false;
        this.closeDialog();
        this.loadEvidencias();
      },
      error: () => {
        this.messageService.add({
          severity: 'error', summary: 'Error', detail: 'No se pudo aprobar la evidencia.'
        });
        this.processing = false;
      },
    });
  }

  rechazar() {
    if (!this.selectedEvidencia || !this.comentario.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Comentario requerido',
        detail: 'Por favor escribe un comentario para rechazar la evidencia.',
      });
      return;
    }
    this.processing = true;
    this.evidenciaService.validar(this.selectedEvidencia.id, {
      estado: 'rechazada',
      comentarioValidador: this.comentario,
      validadoPor: this.validadoPor || 'Validador',
    }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Rechazada',
          detail: 'La evidencia ha sido rechazada.',
        });
        this.processing = false;
        this.closeDialog();
        this.loadEvidencias();
      },
      error: () => {
        this.messageService.add({
          severity: 'error', summary: 'Error', detail: 'No se pudo rechazar la evidencia.'
        });
        this.processing = false;
      },
    });
  }

  getEstadoSeverity(estado: string): string {
    const map = { pendiente: 'warning', aprobada: 'success', rechazada: 'danger' };
    return map[estado] || 'info';
  }

  getCaminanteName(ev: Evidencia): string {
    if (ev.caminante) {
      return `${ev.caminante.nombre} ${ev.caminante.apellidos}`;
    }
    return `#${ev.caminanteId}`;
  }

  isImageFile(url: string): boolean {
    if (!url) return false;
    const ext = url.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  }

  isPdfFile(url: string): boolean {
    if (!url) return false;
    return url.split('.').pop()?.toLowerCase() === 'pdf';
  }

  safePdfUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  isVideoFile(url: string): boolean {
    if (!url) return false;
    const ext = url.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'mov', 'avi'].includes(ext);
  }
}
