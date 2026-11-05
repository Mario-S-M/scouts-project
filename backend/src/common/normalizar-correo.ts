import { Transform } from 'class-transformer';

// Único lugar con la regla de normalización de correos de cuenta (trim + minúsculas).

/** Si es texto, lo devuelve sin espacios a los lados y en minúsculas; si no, sin tocar. */
export function normalizarCorreo<T>(valor: T): T {
  return (typeof valor === 'string' ? valor.trim().toLowerCase() : valor) as T;
}

/** Para DTOs: normaliza el correo antes de que corran las validaciones. */
export const NormalizarCorreo = () => Transform(({ value }) => normalizarCorreo(value));
