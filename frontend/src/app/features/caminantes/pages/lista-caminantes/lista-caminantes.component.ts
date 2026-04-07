import { Component, OnInit } from '@angular/core';
import { CaminanteService } from '../../../../core/services/caminante.service';
import { AuthService, SECCIONES, SECCION_LABEL } from '../../../../core/services/auth.service';
import { Caminante } from '../../../../core/models/caminante.model';

@Component({
  selector: 'app-lista-caminantes',
  templateUrl: './lista-caminantes.component.html',
})
export class ListaCaminantesComponent implements OnInit {
  caminantes: Caminante[] = [];
  loading = true;

  // Filtros
  searchTerm = '';
  filtroSeccion = '';
  filtroEquipo = '';
  filtroPromesa = '';

  // Opciones para dropdowns
  seccionOpciones: { label: string; value: string }[] = [];
  equipoOpciones: { label: string; value: string }[] = [];
  promesaOpciones = [
    { label: 'Con Promesa', value: 'con' },
    { label: 'Sin Promesa', value: 'sin' },
  ];

  // Info del usuario actual
  seccionLabel = '';
  esGrupo = false;

  constructor(
    private caminanteService: CaminanteService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    const user = this.authService.getUser();
    if (user) {
      const seccion = this.authService.getSeccion(user.rol);
      this.seccionLabel = this.authService.getSeccionLabel(seccion);
      this.esGrupo = ['jefe_grupo', 'sub_jefe_grupo', 'colaborador_grupo',
                      'contador_grupo', 'secretario_grupo'].includes(user.rol);
    }

    if (this.esGrupo) {
      this.seccionOpciones = SECCIONES.map(s => ({ label: s.label, value: s.value }));
    }

    this.loadCaminantes();
  }

  loadCaminantes() {
    this.loading = true;
    this.caminanteService.getAll().subscribe({
      next: (data) => {
        this.caminantes = data;
        this.loading = false;
        this.buildEquipoOpciones();
      },
      error: () => { this.loading = false; },
    });
  }

  private buildEquipoOpciones() {
    const equipos = [...new Set(
      this.caminantes.map(c => c.equipo).filter(Boolean)
    )].sort();
    this.equipoOpciones = equipos.map(e => ({ label: e!, value: e! }));
  }

  get filteredCaminantes(): Caminante[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.caminantes.filter(c => {
      const matchSearch = !term || [c.nombre, c.apellidos, c.email, c.cum]
        .some(v => v?.toLowerCase().includes(term));

      const matchSeccion = !this.filtroSeccion || c.seccion === this.filtroSeccion;

      const matchEquipo = !this.filtroEquipo || c.equipo === this.filtroEquipo;

      const matchPromesa =
        !this.filtroPromesa ||
        (this.filtroPromesa === 'con' && !!c.fechaPromesa) ||
        (this.filtroPromesa === 'sin' && !c.fechaPromesa);

      return matchSearch && matchSeccion && matchEquipo && matchPromesa;
    });
  }

  clearFiltros() {
    this.searchTerm = '';
    this.filtroSeccion = '';
    this.filtroEquipo = '';
    this.filtroPromesa = '';
  }

  getInitials(c: Caminante): string {
    return `${c.nombre?.charAt(0) ?? ''}${c.apellidos?.charAt(0) ?? ''}`.toUpperCase();
  }

  getSeccionLabel(seccion: string): string {
    return SECCION_LABEL[seccion] ?? seccion;
  }

  getSeccionStyle(seccion: string): Record<string, string> {
    const map: Record<string, Record<string, string>> = {
      manada:    { background: '#EAB308', color: '#422006' },
      tropa:     { background: '#15803D', color: '#fff' },
      comunidad: { background: '#002CFF', color: '#fff' },
      clan:      { background: '#B91C1C', color: '#fff' },
    };
    return map[seccion] ?? { background: '#6B7280', color: '#fff' };
  }

  get hayFiltrosActivos(): boolean {
    return !!(this.searchTerm || this.filtroSeccion || this.filtroEquipo || this.filtroPromesa);
  }
}
