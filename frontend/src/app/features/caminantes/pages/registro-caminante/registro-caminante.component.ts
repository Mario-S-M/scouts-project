import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { CaminanteService, Tutor } from '../../../../core/services/caminante.service';
import { AuthService, ROL_INFO, SECCIONES } from '../../../../core/services/auth.service';
import { switchMap, of } from 'rxjs';

@Component({
  selector: 'app-registro-caminante',
  templateUrl: './registro-caminante.component.html',
})
export class RegistroCaminanteComponent implements OnInit {
  form: FormGroup;
  submitting = false;
  hoy = new Date();
  secciones = SECCIONES;

  // Datos fijos del grupo — no editables
  readonly GRUPO     = '7';
  readonly PROVINCIA = 'Michoacán';
  readonly COMUNIDAD = 'Itsï Tarhiata';
  readonly CIUDAD    = 'Morelia';

  constructor(
    private fb: FormBuilder,
    private caminanteService: CaminanteService,
    private router: Router,
    private messageService: MessageService,
    private authService: AuthService,
  ) {}

  /** Sección fija del scouter; null para el administrador (elige la sección) */
  seccionFija: string | null = null;

  get tutores(): FormArray {
    return this.form.get('tutores') as FormArray;
  }

  private nuevoTutor(parentesco = ''): FormGroup {
    return this.fb.group({
      nombre:     [''],  // opcional: las filas vacías se ignoran al guardar
      parentesco: [parentesco],
      telefono:   [''],
      email:      ['', Validators.email],
    });
  }

  agregarTutor() {
    if (this.tutores.length < 2) this.tutores.push(this.nuevoTutor());
  }

  quitarTutor(i: number) {
    this.tutores.removeAt(i);
  }

  ngOnInit() {
    this.form = this.fb.group({
      nombre:          ['', [Validators.required, Validators.minLength(2)]],
      apellidos:       ['', [Validators.required, Validators.minLength(2)]],
      seccion:         ['', Validators.required],
      cum:             [''],
      fechaNacimiento: [null],
      equipo:          [''],
      email:           ['', Validators.email],
      fechaPromesa:    [null],
      fechaPaseInicio: [null],
      tutores:         this.fb.array([this.nuevoTutor('Mamá')]),
    });

    const rol = this.authService.getUser()?.rol ?? '';
    const s = ROL_INFO[rol]?.seccion;
    if (s && !['grupo', 'scout'].includes(s) && rol !== 'administrador') {
      this.seccionFija = s;
      this.form.patchValue({ seccion: s });
      this.form.get('seccion')!.disable();
    }
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario incompleto',
        detail: 'Por favor completa todos los campos requeridos.',
      });
      return;
    }

    this.submitting = true;
    const { tutores, ...datos } = this.form.getRawValue();
    const value = {
      ...datos,
      grupo:     this.GRUPO,
      provincia: this.PROVINCIA,
      comunidad: this.COMUNIDAD,
    };

    // Formatear fechas
    for (const key of ['fechaNacimiento', 'fechaPromesa', 'fechaPaseInicio']) {
      if (value[key] instanceof Date) {
        value[key] = value[key].toISOString().split('T')[0];
      }
    }

    const contactos: Tutor[] = (tutores as Tutor[]).filter((t) => t.nombre?.trim());
    this.caminanteService.create(value).pipe(
      switchMap((caminante) => (contactos.length
        ? this.caminanteService.guardarTutores(caminante.id, contactos)
        : of([])).pipe(switchMap(() => of(caminante)))),
    ).subscribe({
      next: (caminante) => {
        this.messageService.add({
          severity: 'success',
          summary: '¡Registrado!',
          detail: `${caminante.nombre} ha sido registrado exitosamente.`,
        });
        this.submitting = false;
        setTimeout(() => this.router.navigate(['/caminantes', caminante.id]), 1500);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.message || 'No se pudo completar el registro. Intenta de nuevo.',
        });
        this.submitting = false;
      },
    });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return ctrl && ctrl.invalid && ctrl.touched;
  }
}
