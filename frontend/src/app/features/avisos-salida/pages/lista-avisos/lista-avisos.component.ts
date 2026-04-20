import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AvisoService, AvisoResumen } from '../../../../core/services/aviso.service';
import { MessageService, ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-lista-avisos',
  templateUrl: './lista-avisos.component.html',
})
export class ListaAvisosComponent implements OnInit {
  avisos: AvisoResumen[] = [];
  loading = false;
  descargando: number | null = null;
  descargandoPermisos: number | null = null;

  constructor(
    private avisoService: AvisoService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadAvisos();
  }

  loadAvisos() {
    this.loading = true;
    this.avisoService.getAll().subscribe({
      next: (data) => { this.avisos = data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  nuevo() {
    this.router.navigate(['/avisos-salida/nuevo']);
  }

  editar(aviso: AvisoResumen) {
    this.router.navigate(['/avisos-salida/editar', aviso.id]);
  }

  descargar(aviso: AvisoResumen) {
    this.descargando = aviso.id;
    this.avisoService.downloadPdf(aviso.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aviso-salida-${aviso.nombre.replace(/\s+/g, '-')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.descargando = null;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el PDF.' });
        this.descargando = null;
      },
    });
  }

  descargarPermisos(aviso: AvisoResumen) {
    this.descargandoPermisos = aviso.id;
    this.avisoService.downloadPermisos(aviso.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `permisos-${aviso.nombre.replace(/\s+/g, '-')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.descargandoPermisos = null;
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar los permisos.' });
        this.descargandoPermisos = null;
      },
    });
  }

  confirmarEliminar(aviso: AvisoResumen) {
    this.confirmationService.confirm({
      message: `¿Eliminar el aviso "<strong>${aviso.nombre}</strong>"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.avisoService.delete(aviso.id).subscribe({
          next: () => {
            this.avisos = this.avisos.filter(a => a.id !== aviso.id);
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Aviso eliminado.' });
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.' });
          },
        });
      },
    });
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const date = new Date(d + 'T12:00:00');
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}
