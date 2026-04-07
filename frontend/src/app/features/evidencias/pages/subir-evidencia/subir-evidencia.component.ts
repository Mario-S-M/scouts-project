import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { EvidenciaService } from '../../../../core/services/evidencia.service';
import { CaminanteService } from '../../../../core/services/caminante.service';
import { Caminante } from '../../../../core/models/caminante.model';

const CATALOG = {
  sendero: {
    Cenit: ['Alimentación Saludable', 'Actividad Física', 'Salud Mental', 'Primeros Auxilios', 'Higiene y Prevención'],
    Cima: ['Biodiversidad', 'Cambio Climático', 'Agua y Océanos', 'Residuos y Reciclaje', 'Energía Renovable'],
    Cumbre: ['Ciudadanía Activa', 'Derechos Humanos', 'Resolución de Conflictos', 'Liderazgo Comunitario', 'Servicio Social'],
    Cuspide: ['Comunicación Efectiva', 'Emprendimiento', 'Tecnología Digital', 'Gestión del Tiempo', 'Pensamiento Crítico'],
  },
  especialidad: {
    Cenit: ['Alimentación Saludable', 'Actividad Física', 'Salud Mental', 'Primeros Auxilios', 'Higiene y Prevención'],
    Cima: ['Biodiversidad', 'Cambio Climático', 'Agua y Océanos', 'Residuos y Reciclaje', 'Energía Renovable'],
    Cumbre: ['Ciudadanía Activa', 'Derechos Humanos', 'Resolución de Conflictos', 'Liderazgo Comunitario', 'Servicio Social'],
    Cuspide: ['Comunicación Efectiva', 'Emprendimiento', 'Tecnología Digital', 'Gestión del Tiempo', 'Pensamiento Crítico'],
  },
  aventura: {
    Aventura: ['TerraNova', 'KonTiki', '7Cimas', 'Discovery'],
  },
  iniciativa: {
    'Iniciativa Mundial': ['MOP', 'ChampionsForNature', 'PlasticTideTurners', 'ScoutsGoSolar', 'AccionesHumanitarias'],
  },
  evento: {
    Evento: ['Provincia', 'Nacional', 'Internacional'],
  },
  puntaDeFlecha: {
    'Punta de Flecha': ['participacion', 'certificacion'],
  },
};

const EJE_LABEL: Record<string, string> = {
  Cenit: 'Salud y Bienestar',
  Cima: 'Medio Ambiente y Sustentabilidad',
  Cumbre: 'Paz y Acción Comunitaria',
  Cuspide: 'Habilidades para la Vida',
};

const ETAPAS_BY_TIPO = {
  sendero: ['conozco', 'aplico', 'comparto'],
  especialidad: ['conozco', 'aplico', 'comparto'],
  aventura: [],
  iniciativa: ['participacion', 'certificacion'],
  evento: [],
  puntaDeFlecha: ['participacion', 'certificacion'],
};

@Component({
  selector: 'app-subir-evidencia',
  templateUrl: './subir-evidencia.component.html',
})
export class SubirEvidenciaComponent implements OnInit {
  form: FormGroup;
  submitting = false;
  selectedFile: File = null;

  caminantes: Caminante[] = [];
  loadingCaminantes = false;

  tiposOptions = [
    { label: 'Especialidad / Eje Temático', value: 'especialidad' },
    { label: 'Aventura en la Naturaleza', value: 'aventura' },
    { label: 'Iniciativa Mundial', value: 'iniciativa' },
    { label: 'Evento', value: 'evento' },
    { label: 'Punta de Flecha', value: 'puntaDeFlecha' },
  ];

  categoriaOptions: { label: string; value: string }[] = [];
  subcategoriaOptions: { label: string; value: string }[] = [];
  etapaOptions: { label: string; value: string }[] = [];

  etapaLabels = {
    conozco: 'Conozco',
    aplico: 'Aplico',
    comparto: 'Comparto',
    participacion: 'Participación',
    certificacion: 'Certificación',
  };

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private evidenciaService: EvidenciaService,
    private caminanteService: CaminanteService,
    private messageService: MessageService,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      caminanteId: [null, Validators.required],
      tipo: [null, Validators.required],
      categoria: [null, Validators.required],
      subcategoria: [null],
      etapa: [null],
      descripcion: [''],
    });

    this.loadCaminantes();

    // Pre-fill caminanteId from query params
    const qpId = this.route.snapshot.queryParams['caminanteId'];
    if (qpId) {
      this.form.patchValue({ caminanteId: +qpId });
    }

    this.form.get('tipo').valueChanges.subscribe((tipo) => {
      this.form.patchValue({ categoria: null, subcategoria: null, etapa: null });
      this.updateCategorias(tipo);
      this.subcategoriaOptions = [];
      this.etapaOptions = [];
    });

    this.form.get('categoria').valueChanges.subscribe((cat) => {
      this.form.patchValue({ subcategoria: null, etapa: null });
      const tipo = this.form.get('tipo').value;
      this.updateSubcategorias(tipo, cat);
      this.updateEtapas(tipo);
    });
  }

  loadCaminantes() {
    this.loadingCaminantes = true;
    this.caminanteService.getAll().subscribe({
      next: (data) => {
        this.caminantes = data;
        this.loadingCaminantes = false;
      },
      error: () => { this.loadingCaminantes = false; },
    });
  }

  updateCategorias(tipo: string) {
    if (!tipo || !CATALOG[tipo]) {
      this.categoriaOptions = [];
      return;
    }
    this.categoriaOptions = Object.keys(CATALOG[tipo]).map((k) => ({
      label: tipo === 'especialidad' && EJE_LABEL[k] ? `${k} (${EJE_LABEL[k]})` : k,
      value: k,
    }));
  }

  updateSubcategorias(tipo: string, cat: string) {
    if (!tipo || !cat || !CATALOG[tipo] || !CATALOG[tipo][cat]) {
      this.subcategoriaOptions = [];
      return;
    }
    this.subcategoriaOptions = CATALOG[tipo][cat].map((v: string) => ({
      label: v, value: v,
    }));
  }

  updateEtapas(tipo: string) {
    const etapas = ETAPAS_BY_TIPO[tipo] || [];
    this.etapaOptions = etapas.map((e: string) => ({
      label: this.etapaLabels[e] || e, value: e,
    }));
  }

  onFileSelect(event: any) {
    if (event.files && event.files.length > 0) {
      this.selectedFile = event.files[0];
    }
  }

  onFileRemove() {
    this.selectedFile = null;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario incompleto',
        detail: 'Por favor completa los campos requeridos.',
      });
      return;
    }

    this.submitting = true;
    const val = this.form.value;

    this.evidenciaService.create(val, this.selectedFile).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Evidencia enviada',
          detail: 'La evidencia ha sido enviada para revisión.',
        });
        this.submitting = false;
        this.form.reset();
        this.selectedFile = null;
        const caminanteId = val.caminanteId;
        setTimeout(() => this.router.navigate(['/caminantes', caminanteId]), 1500);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo enviar la evidencia.',
        });
        this.submitting = false;
      },
    });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return ctrl && ctrl.invalid && ctrl.touched;
  }

  get tipoValue() { return this.form.get('tipo')?.value; }
}
