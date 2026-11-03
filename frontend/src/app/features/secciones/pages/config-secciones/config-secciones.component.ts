import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { SeccionConfig, SeccionService } from '../../../../core/services/seccion.service';

const ORDEN = ['grupo', 'manada', 'tropa', 'comunidad', 'clan'];

/** Administración: nombres, colores, logo y progresión de cada sección */
@Component({
  selector: 'app-config-secciones',
  templateUrl: './config-secciones.component.html',
  styleUrls: ['./config-secciones.component.scss'],
})
export class ConfigSeccionesComponent implements OnInit {
  secciones: SeccionConfig[] = [];
  guardando: string | null = null;
  subiendo: string | null = null;

  readonly campos: { key: keyof SeccionConfig; label: string; ayuda?: string }[] = [
    { key: 'nombreCompleto', label: 'Nombre completo', ayuda: 'Ej: Manada de Lobatos' },
    { key: 'nombreCorto', label: 'Nombre corto', ayuda: 'Pestaña del menú' },
    { key: 'jovenSingular', label: 'Joven (singular)', ayuda: 'Ej: lobato o lobezna' },
    { key: 'jovenPlural', label: 'Jóvenes (plural)', ayuda: 'Ej: lobatos y lobeznas' },
    { key: 'cargoJefe', label: 'Cargo del jefe' },
    { key: 'cargoSubjefe', label: 'Cargo del subjefe' },
  ];
  readonly colores: { key: keyof SeccionConfig; label: string }[] = [
    { key: 'colorPrincipal', label: 'Principal' },
    { key: 'colorOscuro', label: 'Oscuro' },
    { key: 'colorAcento', label: 'Acento' },
    { key: 'colorTextoAcento', label: 'Texto sobre acento' },
  ];

  constructor(private seccionService: SeccionService, private msg: MessageService) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.seccionService.cargar().subscribe((lista) => {
      this.secciones = [...lista]
        .sort((a, b) => ORDEN.indexOf(a.clave) - ORDEN.indexOf(b.clave))
        .map((s) => ({ ...s }));
    });
  }

  logo(s: SeccionConfig): string {
    return s.logo || 'assets/images/logo-grupo.png';
  }

  guardar(s: SeccionConfig) {
    const { clave, logo, ...cambios } = s as any;
    delete cambios.updatedAt;
    this.guardando = clave;
    this.seccionService.actualizar(clave, cambios).subscribe({
      next: () => {
        this.guardando = null;
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: `${s.nombreCompleto} actualizada.` });
        this.cargar();
      },
      error: (err) => {
        this.guardando = null;
        const m = err?.error?.message;
        this.msg.add({ severity: 'error', summary: 'Error', detail: Array.isArray(m) ? m.join(' · ') : m || 'No se pudo guardar.' });
      },
    });
  }

  subirLogo(s: SeccionConfig, ev: Event) {
    const archivo = (ev.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    this.subiendo = s.clave;
    this.seccionService.subirLogo(s.clave, archivo).subscribe({
      next: () => {
        this.subiendo = null;
        this.msg.add({ severity: 'success', summary: 'Logo actualizado', detail: s.nombreCompleto });
        this.cargar();
      },
      error: (err) => {
        this.subiendo = null;
        this.msg.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo subir el logo.' });
      },
    });
    (ev.target as HTMLInputElement).value = '';
  }

  quitarLogo(s: SeccionConfig) {
    this.seccionService.quitarLogo(s.clave).subscribe(() => this.cargar());
  }
}
