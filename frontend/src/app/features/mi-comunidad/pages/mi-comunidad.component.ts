import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { CaminanteService } from '../../../core/services/caminante.service';
import { EvidenciaService } from '../../../core/services/evidencia.service';
import { Caminante, CaminanteProgreso } from '../../../core/models/caminante.model';
import { Evidencia } from '../../../core/models/evidencia.model';

// ── Estructura del programa ───────────────────────────────────────────────────

const EJES = [
  {
    nombre: 'Salud y Bienestar',
    sendero: 'Cenit',
    icono: 'pi pi-heart',
    color: '#10B981',
    descripcion: 'Autocuidado, salud física, mental y emocional.',
    caminos: [
      'Alimentación Saludable', 'Actividad Física', 'Salud Mental',
      'Primeros Auxilios', 'Higiene y Prevención',
    ],
  },
  {
    nombre: 'Habilidades para la Vida',
    sendero: 'Cuspide',
    icono: 'pi pi-bolt',
    color: '#7C3AED',
    descripcion: 'Habilidades personales e interpersonales para el futuro.',
    caminos: [
      'Comunicación Efectiva', 'Emprendimiento', 'Tecnología Digital',
      'Gestión del Tiempo', 'Pensamiento Crítico',
    ],
  },
  {
    nombre: 'Paz y Acción Comunitaria',
    sendero: 'Cumbre',
    icono: 'pi pi-globe',
    color: '#F59E0B',
    descripcion: 'Convivencia, liderazgo comunitario y cultura de paz.',
    caminos: [
      'Ciudadanía Activa', 'Derechos Humanos', 'Resolución de Conflictos',
      'Liderazgo Comunitario', 'Servicio Social',
    ],
  },
  {
    nombre: 'Medio Ambiente y Sustentabilidad',
    sendero: 'Cima',
    icono: 'pi pi-leaf',
    color: '#22C55E',
    descripcion: 'Conexión y cuidado del entorno natural y el planeta.',
    caminos: [
      'Biodiversidad', 'Cambio Climático', 'Agua y Océanos',
      'Residuos y Reciclaje', 'Energía Renovable',
    ],
  },
];

// ── Tipos internos ────────────────────────────────────────────────────────────

interface EtapaEstado {
  etapa: 'conozco' | 'aplico' | 'comparto';
  label: string;
  completado: boolean;
  estadoEvidencia: 'pendiente' | 'aprobada' | 'rechazada' | null;
  comentario: string | null;
}

interface CaminoEstado {
  nombre: string;
  etapas: EtapaEstado[];
  completado: boolean;
}

interface EjeEstado {
  nombre: string;
  sendero: string;
  icono: string;
  color: string;
  descripcion: string;
  caminos: CaminoEstado[];
  completados: number;
  totalCaminos: number;
  etapasCompletadas: number;
  totalEtapas: number;
  porcentaje: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-mi-comunidad',
  templateUrl: './mi-comunidad.component.html',
})
export class MiComunidadComponent implements OnInit {
  caminante: Caminante = null;
  ejes: EjeEstado[] = [];
  loading = true;

  // Eje expandido (-1 = ninguno)
  ejeExpandido = -1;

  // Dialog de evidencia
  showDialog = false;
  dialogLoading = false;
  dialogEje: EjeEstado = null;
  dialogCamino = '';
  dialogEtapa: 'conozco' | 'aplico' | 'comparto' = 'conozco';
  descripcion = '';
  selectedFile: File = null;

  readonly etapaLabels: Record<string, string> = { conozco: 'Conozco', aplico: 'Aplico', comparto: 'Comparto' };

  // Todas las evidencias del scout (para la pestaña de historial)
  evidencias: Evidencia[] = [];

  constructor(
    private caminanteService: CaminanteService,
    private evidenciaService: EvidenciaService,
    private messageService: MessageService,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.caminanteService.getMe().subscribe({
      next: (c) => {
        this.caminante = c;
        this.loadProgreso();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar tu perfil.' });
        this.loading = false;
      },
    });
  }

  loadProgreso() {
    forkJoin({
      progreso: this.caminanteService.getMiProgreso(),
      evidencias: this.evidenciaService.getAll(this.caminante.id),
    }).subscribe({
      next: ({ progreso, evidencias }) => {
        this.evidencias = evidencias;
        this.ejes = this.buildEjes(progreso, evidencias);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  private buildEjes(progreso: CaminanteProgreso, evidencias: Evidencia[]): EjeEstado[] {
    return EJES.map(eje => {
      const senderoData = progreso?.senderos?.find(s => s.sendero === eje.sendero);

      const caminos: CaminoEstado[] = eje.caminos.map(nombre => {
        const caminoData = senderoData?.caminos?.find(c => c.camino === nombre);

        const etapas: EtapaEstado[] = (['conozco', 'aplico', 'comparto'] as const).map(etapa => {
          const completado = !!(caminoData?.[etapa]);

          // Evidencia más reciente para esta combinación sendero+camino+etapa
          const ev = evidencias
            .filter(e =>
              e.tipo === 'especialidad' &&
              e.categoria === eje.sendero &&
              e.subcategoria === nombre &&
              e.etapa === etapa,
            )
            .sort((a, b) => new Date(b.fechaSubida).getTime() - new Date(a.fechaSubida).getTime())[0] ?? null;

          return {
            etapa,
            label: this.etapaLabels[etapa],
            completado,
            estadoEvidencia: ev?.estado ?? null,
            comentario: ev?.comentarioValidador ?? null,
          };
        });

        return {
          nombre,
          etapas,
          completado: etapas.every(e => e.completado),
        };
      });

      const etapasCompletadas = caminos.reduce((n, c) => n + c.etapas.filter(e => e.completado).length, 0);
      const totalEtapas = eje.caminos.length * 3;

      return {
        nombre: eje.nombre,
        sendero: eje.sendero,
        icono: eje.icono,
        color: eje.color,
        descripcion: eje.descripcion,
        caminos,
        completados: caminos.filter(c => c.completado).length,
        totalCaminos: eje.caminos.length,
        etapasCompletadas,
        totalEtapas,
        porcentaje: Math.round((etapasCompletadas / totalEtapas) * 100),
      };
    });
  }

  // ── Interacción ─────────────────────────────────────────────────────────────

  toggleEje(idx: number) {
    this.ejeExpandido = this.ejeExpandido === idx ? -1 : idx;
  }

  abrirDialog(eje: EjeEstado, camino: string, etapa: 'conozco' | 'aplico' | 'comparto') {
    this.dialogEje = eje;
    this.dialogCamino = camino;
    this.dialogEtapa = etapa;
    this.descripcion = '';
    this.selectedFile = null;
    this.showDialog = true;
  }

  onFileSelect(event: any) {
    if (event.files?.length > 0) this.selectedFile = event.files[0];
  }

  onFileRemove() { this.selectedFile = null; }

  subirEvidencia() {
    if (!this.descripcion.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Descripción requerida', detail: 'Explica brevemente tu actividad.' });
      return;
    }
    this.dialogLoading = true;
    this.evidenciaService.create({
      caminanteId: this.caminante.id,
      tipo: 'especialidad',           // Las especialidades del eje son las que se suben
      categoria: this.dialogEje.sendero,   // senderoArea: Cenit, Cima, Cumbre, Cuspide
      subcategoria: this.dialogCamino,     // nombre del camino/especialidad
      etapa: this.dialogEtapa,
      descripcion: this.descripcion,
    }, this.selectedFile).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: '¡Evidencia enviada!',
          detail: 'Será revisada por tu jefe de comunidad.',
        });
        this.showDialog = false;
        this.dialogLoading = false;
        this.loadProgreso();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo enviar la evidencia.' });
        this.dialogLoading = false;
      },
    });
  }

  // ── Helpers de UI ────────────────────────────────────────────────────────────

  // Puede subir evidencia solo si la etapa anterior ya está completada
  puedeSubir(etapa: EtapaEstado, etapas: EtapaEstado[]): boolean {
    if (etapa.completado) return false;
    if (etapa.estadoEvidencia === 'pendiente') return false;
    const idx = etapas.indexOf(etapa);
    if (idx > 0 && !etapas[idx - 1].completado) return false;
    return true;
  }

  etapasBloqueada(etapa: EtapaEstado, etapas: EtapaEstado[]): boolean {
    const idx = etapas.indexOf(etapa);
    return idx > 0 && !etapas[idx - 1].completado && !etapa.completado;
  }

  etapaIcon(etapa: EtapaEstado): string {
    if (etapa.completado) return 'pi pi-check-circle';
    if (etapa.estadoEvidencia === 'pendiente') return 'pi pi-clock';
    if (etapa.estadoEvidencia === 'rechazada') return 'pi pi-times-circle';
    return 'pi pi-circle';
  }

  etapaStyle(etapa: EtapaEstado): Record<string, string> {
    if (etapa.completado) return { color: '#16A34A', fontWeight: '600' };
    if (etapa.estadoEvidencia === 'pendiente') return { color: '#D97706', fontWeight: '600' };
    if (etapa.estadoEvidencia === 'rechazada') return { color: '#DC2626', fontWeight: '600' };
    return { color: '#9CA3AF' };
  }

  estadoSeverity(estado: string): string {
    return { aprobada: 'success', rechazada: 'danger', pendiente: 'warning' }[estado] ?? 'info';
  }

  get totalProgreso(): number {
    if (!this.ejes.length) return 0;
    const total = this.ejes.reduce((s, e) => s + e.totalEtapas, 0);
    const completadas = this.ejes.reduce((s, e) => s + e.etapasCompletadas, 0);
    return Math.round((completadas / total) * 100);
  }

  get nombreCompleto(): string {
    return `${this.caminante?.nombre ?? ''} ${this.caminante?.apellidos ?? ''}`.trim();
  }
}
