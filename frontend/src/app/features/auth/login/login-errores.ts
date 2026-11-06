import type { AbstractControl, ValidationErrors } from '@angular/forms';

/** Textos del login. Los define el frontend: nunca se muestra el mensaje del backend. */
export const TEXTOS = {
  correoVacio: 'Escribe tu correo',
  correoFormato: 'Revisa el correo, por ejemplo nombre@scouts.mx',
  correoEspacios: 'El correo no puede tener espacios',
  passwordVacia: 'Escribe tu contraseña',
  credenciales: 'Correo o contraseña incorrectos',
  sinConexion: 'No pudimos conectar con el servidor, revisa tu conexión',
  esperaFin: 'Ya puedes intentarlo de nuevo',
} as const;

/** 'Demasiados intentos. Espera N segundos e inténtalo de nuevo' */
export function textoEsperaInicio(segundos: number): string {
  return `Demasiados intentos. Espera ${segundos} segundos e inténtalo de nuevo`;
}

/** trim + minúsculas; si no es string devuelve '' */
export function normalizarCorreo(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim().toLowerCase() : '';
}

/** Validador: { espacios: true } si el valor, ya con trim, contiene algún espacio; si no, null */
export function sinEspaciosValidator(control: AbstractControl): ValidationErrors | null {
  const valor = typeof control.value === 'string' ? control.value.trim() : '';
  return /\s/.test(valor) ? { espacios: true } : null;
}

/** 400 y 401 → TEXTOS.credenciales; cualquier otro status (0, 403, 404, 5xx…) → TEXTOS.sinConexion. El 429 no pasa por aquí. */
export function mensajePorStatus(status: number): string {
  return status === 400 || status === 401 ? TEXTOS.credenciales : TEXTOS.sinConexion;
}

/** Entero > 0 desde la cabecera Retry-After (en segundos); si falta, no es número o es ≤ 0 → porDefecto */
export function leerRetryAfter(valor: string | null, porDefecto = 60): number {
  if (valor === null || !/^\s*\d+\s*$/.test(valor)) return porDefecto;
  const segundos = Number.parseInt(valor, 10);
  return segundos > 0 ? segundos : porDefecto;
}
