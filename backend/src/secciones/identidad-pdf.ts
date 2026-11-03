import * as fs from 'fs';
import * as path from 'path';
import { SeccionConfig } from './seccion-config.entity';

/** Mezcla con blanco (t > 0) o con negro (t < 0) */
export function tono(hex: string, t: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)),
  );
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export interface IdentidadPdf {
  config: SeccionConfig | null;
  nombre: string;
  /** Paleta derivada de los colores de la sección */
  principal: string;
  principalMedio: string;
  principalClaro: string;
  acento: string;
  acentoOscuro: string;
  acentoClaro: string;
  /** Logo de la derecha del encabezado: horizontal (Comunidad) o cuadrado (otras) */
  logoDerecha: string | null;
  logoDerechaHorizontal: boolean;
}

let logoCCHorizontal: string | null | undefined;

function dataUrl(ruta: string): string {
  const ext = path.extname(ruta).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${fs.readFileSync(ruta).toString('base64')}`;
}

/**
 * Identidad visual de un documento según su sección. La Comunidad usa su logo
 * horizontal de siempre; las demás, el logo que suba el administrador (o ninguno).
 */
export function identidadPdf(config: SeccionConfig | null, rutaLogoSeccion: string | null): IdentidadPdf {
  const principal = config?.colorPrincipal ?? '#14265C';
  const acento = config?.colorAcento ?? '#EFC02F';
  let logoDerecha: string | null = null;
  let horizontal = false;
  if (config?.clave === 'comunidad') {
    if (logoCCHorizontal === undefined) {
      const assets = path.join(__dirname, '../../public/assets');
      const p = ['logo_CC_pdf.png', 'logo_CC.png'].map((f) => path.join(assets, f)).find((f) => fs.existsSync(f));
      logoCCHorizontal = p ? dataUrl(p) : null;
    }
    logoDerecha = logoCCHorizontal;
    horizontal = true;
  } else if (rutaLogoSeccion) {
    logoDerecha = dataUrl(rutaLogoSeccion);
  }
  return {
    config,
    nombre: config?.nombreCompleto ?? 'Grupo Scout 7',
    principal,
    principalMedio: tono(principal, 0.25),
    principalClaro: tono(principal, 0.92),
    acento,
    acentoOscuro: tono(acento, -0.25),
    acentoClaro: tono(acento, 0.88),
    logoDerecha,
    logoDerechaHorizontal: horizontal,
  };
}
