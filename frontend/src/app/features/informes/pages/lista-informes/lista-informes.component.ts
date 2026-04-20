import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { InformeService } from '../../../../core/services/informe.service';
import { InformeMensual, MESES_NOMBRES } from '../../../../core/models/informe.model';

@Component({
  selector: 'app-lista-informes',
  templateUrl: './lista-informes.component.html',
})
export class ListaInformesComponent implements OnInit {
  informes: InformeMensual[] = [];
  loading = false;
  descargando: number | null = null;
  readonly meses = MESES_NOMBRES;

  constructor(
    private svc: InformeService,
    private msg: MessageService,
    private confirm: ConfirmationService,
    private router: Router,
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.svc.getAll().subscribe({
      next: (d) => { this.informes = d; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  nuevo() { this.router.navigate(['/informes/nuevo']); }
  editar(i: InformeMensual) { this.router.navigate(['/informes/editar', i.id]); }

  descargar(i: InformeMensual) {
    this.descargando = i.id;
    this.svc.downloadPdf(i.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe-${this.meses[i.mes]}-${i.anio}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.descargando = null;
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el PDF.' });
        this.descargando = null;
      },
    });
  }

  confirmarEliminar(i: InformeMensual) {
    this.confirm.confirm({
      message: `¿Eliminar el informe de <strong>${this.meses[i.mes]} ${i.anio}</strong>?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-trash',
      acceptLabel: 'Eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.svc.delete(i.id).subscribe({
          next: () => {
            this.informes = this.informes.filter(x => x.id !== i.id);
            this.msg.add({ severity: 'success', summary: 'Eliminado', detail: 'Informe eliminado.' });
          },
          error: () => this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.' }),
        });
      },
    });
  }
}
