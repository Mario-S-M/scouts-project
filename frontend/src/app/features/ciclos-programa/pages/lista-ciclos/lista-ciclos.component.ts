import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CicloProgramaService } from '../../../../core/services/ciclo-programa.service';
import { CicloPrograma, MESES_NOMBRES } from '../../../../core/models/ciclo-programa.model';

@Component({
  selector: 'app-lista-ciclos',
  templateUrl: './lista-ciclos.component.html',
})
export class ListaCiclosComponent implements OnInit {
  ciclos: CicloPrograma[] = [];
  loading = false;
  descargando: number | null = null;

  readonly meses = MESES_NOMBRES;

  constructor(
    private svc: CicloProgramaService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.svc.getAll().subscribe({
      next: (data) => { this.ciclos = data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  nuevo() {
    this.router.navigate(['/ciclos-programa/nuevo']);
  }

  editar(ciclo: CicloPrograma) {
    this.router.navigate(['/ciclos-programa/editar', ciclo.id]);
  }

  descargar(ciclo: CicloPrograma) {
    this.descargando = ciclo.id;
    this.svc.downloadPdf(ciclo.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `ciclo-${ciclo.nombre.replace(/\s+/g, '-')}.pdf`;
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

  confirmarEliminar(ciclo: CicloPrograma) {
    this.confirmationService.confirm({
      message: `¿Eliminar el ciclo "<strong>${ciclo.nombre}</strong>"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.svc.delete(ciclo.id).subscribe({
          next: () => {
            this.ciclos = this.ciclos.filter(c => c.id !== ciclo.id);
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Ciclo eliminado.' });
          },
          error: () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.' });
          },
        });
      },
    });
  }

  periodoLabel(ciclo: CicloPrograma): string {
    const meses = ciclo.tipo === 'trimestral' ? 3 : 4;
    const mesFin = ((ciclo.mesInicio - 1 + meses) % 12) + 1;
    const anioFin = ciclo.mesInicio + meses - 1 > 12 ? ciclo.anio + 1 : ciclo.anio;
    return mesFin < ciclo.mesInicio
      ? `${this.meses[ciclo.mesInicio]} ${ciclo.anio} – ${this.meses[mesFin]} ${anioFin}`
      : `${this.meses[ciclo.mesInicio]} – ${this.meses[mesFin]} ${ciclo.anio}`;
  }

  tipoLabel(tipo: string): string {
    return tipo === 'trimestral' ? 'Trimestral' : 'Cuatrimestral';
  }

  fmtDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
