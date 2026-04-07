import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { CaminanteService } from '../../../../core/services/caminante.service';
import { SECCIONES } from '../../../../core/services/auth.service';

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
  ) {}

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
    });
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
    const value = {
      ...this.form.value,
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

    this.caminanteService.create(value).subscribe({
      next: (caminante) => {
        this.messageService.add({
          severity: 'success',
          summary: '¡Registrado!',
          detail: `${caminante.nombre} ha sido registrado exitosamente.`,
        });
        this.submitting = false;
        setTimeout(() => this.router.navigate(['/caminantes', caminante.id]), 1500);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo registrar el caminante. Intenta de nuevo.',
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
