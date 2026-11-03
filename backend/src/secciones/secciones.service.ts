import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { SeccionConfig } from './seccion-config.entity';
import { SECCIONES_DEFAULT } from './secciones.defaults';
import { ActualizarSeccionDto } from './dto/actualizar-seccion.dto';
import { IdentidadPdf, identidadPdf } from './identidad-pdf';

@Injectable()
export class SeccionesService {
  constructor(@InjectRepository(SeccionConfig) private repo: Repository<SeccionConfig>) {}

  /** Crea las secciones que falten con sus valores iniciales; no toca las existentes */
  async seed(): Promise<void> {
    for (const s of SECCIONES_DEFAULT) {
      if (!(await this.repo.findOneBy({ clave: s.clave }))) await this.repo.save(this.repo.create(s));
    }
    // Logo de la Comunidad (emblema del sol) en uploads, si aún no está
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const destino = path.join(uploadDir, 'secciones', 'comunidad.png');
    const origen = path.join(__dirname, '../../public/assets/logo_CC_emblema.png');
    if (!fs.existsSync(destino) && fs.existsSync(origen)) {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.copyFileSync(origen, destino);
    }
  }

  findAll(): Promise<SeccionConfig[]> {
    return this.repo.find({ order: { clave: 'ASC' } });
  }

  async findOne(clave: string): Promise<SeccionConfig> {
    const s = await this.repo.findOneBy({ clave });
    if (!s) throw new NotFoundException(`Sección "${clave}" no existe`);
    return s;
  }

  async update(clave: string, dto: ActualizarSeccionDto): Promise<SeccionConfig> {
    const s = await this.findOne(clave);
    Object.assign(s, dto);
    return this.repo.save(s);
  }

  async setLogo(clave: string, ruta: string | null): Promise<SeccionConfig> {
    const s = await this.findOne(clave);
    s.logo = ruta;
    return this.repo.save(s);
  }

  /** Ruta en disco del logo de una sección (para incrustarlo en PDFs), o null */
  rutaLogoEnDisco(s: SeccionConfig | null): string | null {
    if (!s?.logo?.startsWith('/uploads/')) return null;
    const p = path.join(process.env.UPLOAD_DIR || './uploads', s.logo.slice('/uploads/'.length));
    return fs.existsSync(p) ? p : null;
  }

  /** Colores, nombre y logo para los PDFs de una sección (null/grupo = identidad del grupo) */
  async identidadPdf(seccion: string | null | undefined): Promise<IdentidadPdf> {
    const config = await this.repo.findOneBy({ clave: seccion || 'grupo' });
    return identidadPdf(config, this.rutaLogoEnDisco(config));
  }
}
