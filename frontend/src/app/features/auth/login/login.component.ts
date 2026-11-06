import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  TEXTOS,
  leerRetryAfter,
  mensajePorStatus,
  normalizarCorreo,
  sinEspaciosValidator,
  textoEsperaInicio,
} from './login-errores';

type Campo = 'email' | 'password';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnDestroy {
  @ViewChild('emailInput') private emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') private passwordInput?: ElementRef<HTMLInputElement>;

  form: FormGroup<{ email: FormControl<string>; password: FormControl<string> }>;
  loading = false;
  showPassword = false;
  submitted = false;
  /** Error del servidor que se ve en la tarjeta */
  errorMsg: string | null = null;
  /** Texto de la región aria-live: solo cambia cuando hay algo que anunciar */
  liveMsg = '';
  /** Mayor que 0: botón bloqueado mostrando la cuenta regresiva */
  segundosEspera = 0;
  year = new Date().getFullYear();

  private intervalo: ReturnType<typeof setInterval> | null = null;

  constructor(
    fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.form = fb.nonNullable.group({
      email: ['', [Validators.required, Validators.email, sinEspaciosValidator]],
      password: ['', [Validators.required]],
    });
  }

  get bloqueado(): boolean {
    return this.loading || this.segundosEspera > 0;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  /** Trim y minúsculas al salir del campo; no es un error escribir mayúsculas */
  normalizarCorreo(): void {
    const control = this.form.controls.email;
    const limpio = normalizarCorreo(control.value);
    if (limpio !== control.value) control.setValue(limpio, { emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false });
  }

  fieldError(campo: Campo): string | null {
    const control = this.form.controls[campo];
    if (!control.errors || !(control.touched || this.submitted)) return null;
    if (campo === 'password') return TEXTOS.passwordVacia;
    if (control.errors['required']) return TEXTOS.correoVacio;
    if (control.errors['espacios']) return TEXTOS.correoEspacios;
    return TEXTOS.correoFormato;
  }

  onSubmit(): void {
    if (this.bloqueado) return;
    this.normalizarCorreo();
    this.submitted = true;

    if (this.form.invalid) {
      const primero = this.form.controls.email.invalid ? this.emailInput : this.passwordInput;
      primero?.nativeElement.focus();
      return;
    }

    this.errorMsg = null;
    this.loading = true;
    const { email, password } = this.form.getRawValue();

    this.authService.login(email, password).subscribe({
      next: () => {
        this.loading = false;
        const user = this.authService.getUser();
        if (user?.rol === 'scout') {
          // "Mi progreso" es la progresión de Caminantes; las demás secciones entran al calendario
          this.router.navigate([(user.seccion ?? 'comunidad') === 'comunidad' ? '/mi-comunidad' : '/calendario']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        if (err.status === 429) {
          this.iniciarEspera(leerRetryAfter(err.headers?.get('Retry-After') ?? null));
        } else {
          this.mostrarError(mensajePorStatus(err.status));
        }
      },
    });
  }

  ngOnDestroy(): void {
    this.detenerEspera();
  }

  private mostrarError(texto: string): void {
    this.errorMsg = texto;
    this.anunciar(texto);
  }

  /** Si el texto se repite, se vacía primero para que el lector de pantalla lo vuelva a leer */
  private anunciar(texto: string): void {
    if (this.liveMsg === texto) {
      this.liveMsg = '';
      setTimeout(() => (this.liveMsg = texto), 0);
    } else {
      this.liveMsg = texto;
    }
  }

  /** El número cambia en el botón; aria-live solo anuncia al empezar y al terminar */
  private iniciarEspera(segundos: number): void {
    this.detenerEspera();
    this.segundosEspera = segundos;
    this.mostrarError(textoEsperaInicio(segundos));
    this.intervalo = setInterval(() => {
      this.segundosEspera--;
      if (this.segundosEspera <= 0) {
        this.detenerEspera();
        this.errorMsg = null;
        this.anunciar(TEXTOS.esperaFin);
      }
    }, 1000);
  }

  private detenerEspera(): void {
    if (this.intervalo) clearInterval(this.intervalo);
    this.intervalo = null;
    this.segundosEspera = 0;
  }
}
