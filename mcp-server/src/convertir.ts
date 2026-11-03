/**
 * Convierte el .docx del protocolo a PDF con LibreOffice (instalado en la Mac).
 * El backend corre en Docker sin LibreOffice, por eso la conversión vive aquí.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const run = promisify(execFile);

const CANDIDATOS = [
  process.env.SCOUTS_SOFFICE,
  '/opt/homebrew/bin/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
].filter(Boolean) as string[];

async function soffice(): Promise<string | null> {
  for (const c of CANDIDATOS) {
    try { await fs.access(c); return c; } catch { /* siguiente */ }
  }
  return null;
}

/** Devuelve el PDF, o null si LibreOffice no está instalado */
export async function docxAPdf(docx: Buffer): Promise<Buffer | null> {
  const bin = await soffice();
  if (!bin) return null;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scouts-protocolo-'));
  try {
    const entrada = path.join(dir, 'protocolo.docx');
    await fs.writeFile(entrada, docx);
    // Perfil propio para no chocar con un LibreOffice abierto por el usuario
    await run(bin, ['--headless', `-env:UserInstallation=file://${dir}/perfil`, '--convert-to', 'pdf', '--outdir', dir, entrada], { timeout: 90_000 });
    return await fs.readFile(path.join(dir, 'protocolo.pdf'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
