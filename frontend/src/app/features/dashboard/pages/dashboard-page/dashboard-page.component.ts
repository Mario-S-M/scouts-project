import { Component, OnInit } from '@angular/core';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { DashboardStats } from '../../../../core/models/dashboard.model';
import { SeccionService } from '../../../../core/services/seccion.service';

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent implements OnInit {
  stats: DashboardStats = null;
  loading = true;

  constructor(private dashboardService: DashboardService, private seccionService: SeccionService) {}

  /** Evidencias, insignias y senderos solo para secciones con progresión (Comunidad) y el grupo */
  get conProgresion(): boolean {
    const clave = this.seccionService.claveActual();
    return clave === 'grupo' || this.seccionService.progresion(clave);
  }

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loading = true;
    this.dashboardService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading stats', err);
        this.loading = false;
      },
    });
  }

  getEstadoSeverity(estado: string): string {
    const map = { pendiente: 'warning', aprobada: 'success', rechazada: 'danger' };
    return map[estado] || 'info';
  }

  getTipoLabel(tipo: string): string {
    const map = {
      sendero: 'Sendero',
      especialidad: 'Especialidad',
      aventura: 'Aventura',
      iniciativa: 'Iniciativa',
      evento: 'Evento',
      puntaDeFlecha: 'Punta de Flecha',
    };
    return map[tipo] || tipo;
  }

  getCaminanteName(ev: any): string {
    if (ev.caminante) {
      return `${ev.caminante.nombre} ${ev.caminante.apellidos}`;
    }
    return 'N/A';
  }
}
