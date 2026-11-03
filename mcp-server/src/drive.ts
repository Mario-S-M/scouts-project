/**
 * Guarda archivos en la carpeta del grupo sincronizada por Google Drive para
 * escritorio. Drive sube el archivo solo; el link se obtiene del atributo
 * extendido que Drive for Desktop pone a cada archivo sincronizado.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const run = promisify(execFile);

function expandir(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

const DRIVE_DIR = process.env.SCOUTS_DRIVE_DIR ? expandir(process.env.SCOUTS_DRIVE_DIR) : null;
const DRIVE_FOLDER_URL = process.env.SCOUTS_DRIVE_FOLDER_URL || null;
const FALLBACK_DIR = path.join(os.homedir(), 'Downloads', 'Scouts');

/**
 * Carpetas dentro de la carpeta del Consejo. Respetan la estructura que ya usa
 * el grupo: `Informes de Sección/<Sección>/<año>/Informe-<Mes>-<año>.pdf`.
 */
const seccionCap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
export type DocumentoSalida = 'Aviso de salida' | 'Protocolo de traslado' | 'Permiso de padres';

export const carpetas = {
  /**
   * Una carpeta por salida con sus tres documentos:
   * `Documentos 2026/2026-11-14 Pase de Sebastián/{Aviso de salida|Protocolo de traslado|Permiso de padres}`
   */
  salida: (aviso: { fechaSalida?: string | null; nombre: string }, documento: DocumentoSalida) => {
    const anio = (aviso.fechaSalida ?? new Date().toISOString()).slice(0, 4);
    return [`Documentos ${anio}`, `${aviso.fechaSalida ?? ''} ${aviso.nombre}`.trim(), documento];
  },
  informe: (seccion: string, anio: number | string) => ['Informes de Sección', seccionCap(seccion), String(anio)],
  ciclo: (seccion: string, anio: number | string) => ['Ciclos de Programa', seccionCap(seccion), String(anio)],
  solicitud: (seccion: string, anio: number | string) => ['Solicitudes de Insignias', seccionCap(seccion), String(anio)],
};


export interface ArchivoGuardado {
  ruta: string;
  enDrive: boolean;
  link: string | null;
  nota?: string;
}

/** Quita caracteres que Drive / macOS no aceptan en nombres de archivo */
export function nombreSeguro(s: string): string {
  return s.replace(/[\/\\:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

async function leerIdDrive(ruta: string): Promise<string | null> {
  try {
    const { stdout } = await run('xattr', ['-p', 'com.google.drivefs.item-id#S', ruta]);
    const id = stdout.trim();
    return id || null;
  } catch {
    return null;
  }
}

export async function guardarEnDrive(subcarpetas: string[], archivo: string, contenido: Buffer): Promise<ArchivoGuardado> {
  const base = DRIVE_DIR ?? FALLBACK_DIR;
  const dir = path.join(base, ...subcarpetas.map(nombreSeguro));
  await fs.mkdir(dir, { recursive: true });

  // Nunca sobrescribe: la carpeta es compartida y puede tener la versión que subió alguien más
  const nombre = nombreSeguro(archivo);
  const ext = path.extname(nombre);
  const raiz = nombre.slice(0, nombre.length - ext.length);
  let ruta = path.join(dir, nombre);
  for (let n = 2; ; n++) {
    try {
      await fs.writeFile(ruta, contenido, { flag: 'wx' });
      break;
    } catch (e: any) {
      if (e.code !== 'EEXIST' || n > 50) throw e;
      ruta = path.join(dir, `${raiz} (${n})${ext}`);
    }
  }

  if (!DRIVE_DIR) {
    return {
      ruta, enDrive: false, link: null,
      nota: 'SCOUTS_DRIVE_DIR no está configurado: el archivo se guardó localmente, no en Drive.',
    };
  }

  // Drive for Desktop asigna el id al terminar de subir; esperamos hasta ~12 s
  for (let i = 0; i < 6; i++) {
    const id = await leerIdDrive(ruta);
    if (id && !id.startsWith('local')) {
      return { ruta, enDrive: true, link: `https://drive.google.com/file/d/${id}/view` };
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return {
    ruta, enDrive: true, link: DRIVE_FOLDER_URL,
    nota: 'Drive aún no termina de subir el archivo; se usa el link de la carpeta del grupo.',
  };
}
