import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { CaminanteService } from '../../../../core/services/caminante.service';
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

  constructor(
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
      },
      error: () => {
        this.messageService.add({
          severity: 'error', summary: 'Error', detail: 'No se encontró el caminante.'
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
    return `${this.caminante.nombre.charAt(0)}${this.caminante.apellidos.charAt(0)}`;
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
