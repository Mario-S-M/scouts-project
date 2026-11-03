import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { CaminanteService, Tutor } from '../../../../core/services/caminante.service';
import { SeccionService } from '../../../../core/services/seccion.service';
import { AuthService, ROL_INFO } from '../../../../core/services/auth.service';
import { InsigniaService } from '../../../../core/services/insignia.service';
import { Caminante, CaminanteProgreso } from '../../../../core/models/caminante.model';

@Component({
  selector: 'app-perfil-caminante',
  templateUrl: './perfil-caminante.component.html',
})
export class PerfilCaminanteComponent implements OnInit {
  caminante: Caminante = null;
  progreso: CaminanteProgreso = null;
  loading = true;
  calculatingInsignias = false;

  // Papás / tutores
  tutores: Tutor[] = [];
  editandoTutores = false;
  borradorTutores: Tutor[] = [];
  guardandoTutores = false;

  /** Senderos, especialidades e insignias solo para la sección que los usa (Comunidad) */
  get conProgresion(): boolean {
    return !!this.caminante && this.seccionService.progresion(this.caminante.seccion);
  }

  /** El administrador y los scouters de la sección del joven pueden editar */
  get puedeEditar(): boolean {
    const rol = this.authService.getUser()?.rol ?? '';
    return rol === 'administrador' || ROL_INFO[rol]?.seccion === this.caminante?.seccion;
  }

  constructor(
    public seccionService: SeccionService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private caminanteService: CaminanteService,
    private insigniaService: InsigniaService,
    private messageService: MessageService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    this.loadData(+id);
  }

  loadData(id: number) {
    this.loading = true;
    this.caminanteService.getById(id).subscribe({
      next: (c) => {
        this.caminante = c;
        this.loadProgreso(id);
        this.caminanteService.getTutores(id).subscribe({ next: (t) => (this.tutores = t), error: () => undefined });
      },
      error: () => {
        this.messageService.add({
          severity: 'error', summary: 'Error', detail: 'No se encontró a este joven o no pertenece a tu sección.'
        });
        this.router.navigate(['/']);
      },
    });
  }

  loadProgreso(id: number) {
    this.caminanteService.getProgreso(id).subscribe({
      next: (p) => {
        this.progreso = p;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  abrirTutores() {
    this.borradorTutores = this.tutores.length
      ? this.tutores.map(({ nombre, parentesco, telefono, email }) => ({ nombre, parentesco, telefono, email }))
      : [{ nombre: '', parentesco: 'Mamá' }];
    this.editandoTutores = true;
  }

  agregarTutor() {
    if (this.borradorTutores.length < 2) this.borradorTutores.push({ nombre: '', parentesco: '' });
  }

  guardarTutores() {
    const lista = this.borradorTutores.filter((t) => t.nombre?.trim());
    this.guardandoTutores = true;
    this.caminanteService.guardarTutores(this.caminante.id, lista).subscribe({
      next: (t) => {
        this.tutores = t;
        this.editandoTutores = false;
        this.guardandoTutores = false;
        this.messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Papás / tutores actualizados.' });
      },
      error: (err) => {
        this.guardandoTutores = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudieron guardar.' });
      },
    });
  }

  calcularInsignias() {
    if (!this.caminante) return;
    this.calculatingInsignias = true;
    this.insigniaService.calcular(this.caminante.id).subscribe({
      next: (result) => {
        this.calculatingInsignias = false;
        const nuevas = result.insignias.filter(i => i.cumple && i.otorgada);
        if (nuevas.length > 0) {
          this.messageService.add({
            severity: 'success',
            summary: '¡Insignias otorgadas!',
            detail: nuevas.map(i => i.tipo).join(', '),
          });
        } else {
          this.messageService.add({
            severity: 'info',
            summary: 'Sin cambios',
            detail: 'No se cumplen los requisitos para nuevas insignias aún.',
          });
        }
        this.loadData(this.caminante.id);
      },
      error: () => {
        this.calculatingInsignias = false;
        this.messageService.add({
          severity: 'error', summary: 'Error', detail: 'No se pudo calcular las insignias.'
        });
      },
    });
  }

  getInitials(): string {
    if (!this.caminante) return '?';
    return `${this.caminante.nombre?.charAt(0) ?? ''}${this.caminante.apellidos?.charAt(0) ?? ''}`;
  }

  getMesesLabel(meses: number): string {
    if (meses < 1) return 'Menos de 1 mes';
    if (meses === 1) return '1 mes';
    if (meses < 12) return `${meses} meses`;
    const years = Math.floor(meses / 12);
    const rem = meses % 12;
    let label = `${years} año${years > 1 ? 's' : ''}`;
    if (rem > 0) label += ` y ${rem} mes${rem > 1 ? 'es' : ''}`;
    return label;
  }
}
