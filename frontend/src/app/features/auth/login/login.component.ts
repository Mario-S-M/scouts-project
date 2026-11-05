import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

type Campo = 'email' | 'password';

/** Textos del login. Los define el frontend: nunca se muestra el mensaje del backend. */
const TEXTOS = {
  correoVacio: 'Escribe tu correo',
  correoFormato: 'Revisa el correo, por ejemplo nombre@scouts.mx',
  correoEspacios: 'El correo no puede tener espacios',
  passwordVacia: 'Escribe tu contraseña',
  credenciales: 'Correo o contraseña incorrectos',
  sinConexion: 'No pudimos conectar con el servidor, revisa tu conexión',
  esperaFin: 'Ya puedes intentarlo de nuevo',
  esperaInicio: (s: number) => `Demasiados intentos. Espera ${s} segundos e inténtalo de nuevo`,
};

/** Si el servidor no manda Retry-After (o no es válido), se espera esto */
const ESPERA_POR_DEFECTO = 60;

/** Error `espacios` si al correo le quedan espacios después del trim */
function sinEspacios(control: AbstractControl): ValidationErrors | null {
  const valor = (control.value ?? '').toString().trim();
  return /\s/.test(valor) ? { espacios: true } : null;
}

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
      email: ['', [Validators.required, Validators.email, sinEspacios]],
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
    const limpio = control.value.trim().toLowerCase();
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
          this.iniciarEspera(this.leerRetryAfter(err));
        } else if (err.status === 401 || err.status === 400) {
          this.mostrarError(TEXTOS.credenciales);
        } else {
          // Red caída (status 0), 5xx o cualquier otro código inesperado
          this.mostrarError(TEXTOS.sinConexion);
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

  private leerRetryAfter(err: HttpErrorResponse): number {
    const segundos = Number.parseInt(err.headers?.get('Retry-After') ?? '', 10);
    return Number.isInteger(segundos) && segundos > 0 ? segundos : ESPERA_POR_DEFECTO;
  }

  /** El número cambia en el botón; aria-live solo anuncia al empezar y al terminar */
  private iniciarEspera(segundos: number): void {
    this.detenerEspera();
    this.segundosEspera = segundos;
    this.mostrarError(TEXTOS.esperaInicio(segundos));
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
