import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evidencia } from './entities/evidencia.entity';
import { SenderoProgreso } from '../progreso/entities/sendero-progreso.entity';
import { EspecialidadProgreso } from '../progreso/entities/especialidad-progreso.entity';
import { AventuraProgreso } from '../progreso/entities/aventura-progreso.entity';
import { IniciativaProgreso } from '../progreso/entities/iniciativa-progreso.entity';
import { PuntaDeFlecha } from '../progreso/entities/punta-de-flecha.entity';
import { CreateEvidenciaDto, ValidarEvidenciaDto } from './dto/create-evidencia.dto';

@Injectable()
export class EvidenciasService {
  constructor(
    @InjectRepository(Evidencia)
    private evidenciaRepo: Repository<Evidencia>,
    @InjectRepository(SenderoProgreso)
    private senderoRepo: Repository<SenderoProgreso>,
    @InjectRepository(EspecialidadProgreso)
    private especialidadRepo: Repository<EspecialidadProgreso>,
    @InjectRepository(AventuraProgreso)
    private aventuraRepo: Repository<AventuraProgreso>,
    @InjectRepository(IniciativaProgreso)
    private iniciativaRepo: Repository<IniciativaProgreso>,
    @InjectRepository(PuntaDeFlecha)
    private puntaRepo: Repository<PuntaDeFlecha>,
  ) {}

  async findAll(caminanteId?: number, seccion?: string): Promise<Evidencia[]> {
    const query = this.evidenciaRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.caminante', 'c')
      .orderBy('e.fechaSubida', 'DESC');

    if (caminanteId) {
      query.where('e.caminanteId = :caminanteId', { caminanteId });
    }
    if (seccion) {
      query.andWhere('c.seccion = :seccion', { seccion });
    }

    return query.getMany();
  }

  async findPendientes(seccion?: string): Promise<Evidencia[]> {
    const query = this.evidenciaRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.caminante', 'c')
      .where('e.estado = :estado', { estado: 'pendiente' })
      .orderBy('e.fechaSubida', 'DESC');

    if (seccion) {
      query.andWhere('c.seccion = :seccion', { seccion });
    }

    return query.getMany();
  }

  async create(dto: CreateEvidenciaDto, archivoUrl?: string): Promise<Evidencia> {
    // Validar secuencia de etapas (no se puede saltar conozco→aplico→comparto)
    if (dto.etapa && dto.subcategoria) {
      await this.validarSecuenciaEtapa(dto);
    }

    const evidencia = this.evidenciaRepo.create({
      ...dto,
      archivoUrl,
      estado: 'pendiente',
    });
    return this.evidenciaRepo.save(evidencia);
  }

  private async validarSecuenciaEtapa(dto: CreateEvidenciaDto): Promise<void> {
    const orden = ['conozco', 'aplico', 'comparto'];
    const idx = orden.indexOf(dto.etapa);
    if (idx <= 0) return; // 'conozco' no tiene prerequisito

    const etapaAnterior = orden[idx - 1];
    const labels = { conozco: 'Conozco', aplico: 'Aplico', comparto: 'Comparto' };

    if (dto.tipo === 'especialidad') {
      // Busca en EspecialidadProgreso si la etapa anterior ya fue aprobada
      const ep = await this.especialidadRepo.findOne({
        where: { caminanteId: dto.caminanteId, especialidad: dto.subcategoria },
      });
      if (!ep || !ep[etapaAnterior]) {
        throw new BadRequestException(
          `Debes completar "${labels[etapaAnterior]}" antes de enviar evidencia para "${labels[dto.etapa]}".`,
        );
      }
    } else if (dto.tipo === 'sendero') {
      // Busca en SenderoProgreso si la etapa anterior ya fue aprobada
      const sp = await this.senderoRepo.findOne({
        where: { caminanteId: dto.caminanteId, sendero: dto.categoria as any, camino: dto.subcategoria },
      });
      if (!sp || !sp[etapaAnterior]) {
        throw new BadRequestException(
          `Debes completar "${labels[etapaAnterior]}" antes de enviar evidencia para "${labels[dto.etapa]}".`,
        );
      }
    }
  }

  async validar(id: number, dto: ValidarEvidenciaDto): Promise<Evidencia> {
    const evidencia = await this.evidenciaRepo.findOne({ where: { id } });
    if (!evidencia) throw new NotFoundException(`Evidencia #${id} not found`);

    evidencia.estado = dto.estado;
    evidencia.comentarioValidador = dto.comentarioValidador;
    evidencia.validadoPor = dto.validadoPor;
    evidencia.fechaValidacion = new Date();

    const saved = await this.evidenciaRepo.save(evidencia);

    // If approved, update the corresponding progress
    if (dto.estado === 'aprobada') {
      await this.actualizarProgreso(saved);
    }

    return saved;
  }

  private async actualizarProgreso(evidencia: Evidencia) {
    const { tipo, categoria, subcategoria, etapa, caminanteId } = evidencia;

    if (tipo === 'sendero') {
      // categoria = sendero name, subcategoria = camino name
      let sp = await this.senderoRepo.findOne({
        where: {
          caminanteId,
          sendero: categoria as any,
          camino: subcategoria,
        },
      });

      if (!sp) {
        sp = this.senderoRepo.create({
          caminanteId,
          sendero: categoria as any,
          camino: subcategoria,
        });
      }

      if (etapa === 'conozco') sp.conozco = true;
      if (etapa === 'aplico') sp.aplico = true;
      if (etapa === 'comparto') sp.comparto = true;

      if (sp.conozco && sp.aplico && sp.comparto) {
        sp.completado = true;
        sp.fechaCompletado = new Date();
      }

      await this.senderoRepo.save(sp);
    } else if (tipo === 'especialidad') {
      let ep = await this.especialidadRepo.findOne({
        where: {
          caminanteId,
          especialidad: categoria,
        },
      });

      if (!ep) {
        ep = this.especialidadRepo.create({
          caminanteId,
          especialidad: categoria,
          nombre: subcategoria || categoria,
        });
      }

      if (etapa === 'conozco') ep.conozco = true;
      if (etapa === 'aplico') ep.aplico = true;
      if (etapa === 'comparto') ep.comparto = true;

      if (ep.conozco && ep.aplico && ep.comparto) {
        ep.completado = true;
        ep.fechaCompletado = new Date();
      }

      await this.especialidadRepo.save(ep);

      // Si la especialidad corresponde a un camino de un sendero, reflejar el progreso
      if (subcategoria) {
        // categoria = nombre del sendero, subcategoria = nombre del camino
        await this.actualizarSenderoDesdeEspecialidad(caminanteId, categoria, subcategoria, etapa);
      }
    } else if (tipo === 'aventura') {
      let ap = await this.aventuraRepo.findOne({
        where: {
          caminanteId,
          aventura: categoria as any,
        },
      });

      if (!ap) {
        ap = this.aventuraRepo.create({
          caminanteId,
          aventura: categoria as any,
        });
      }

      ap.completado = true;
      ap.fechaCompletado = new Date();
      await this.aventuraRepo.save(ap);
    } else if (tipo === 'iniciativa') {
      let ip = await this.iniciativaRepo.findOne({
        where: {
          caminanteId,
          iniciativa: categoria as any,
        },
      });

      if (!ip) {
        ip = this.iniciativaRepo.create({
          caminanteId,
          iniciativa: categoria as any,
          nivel: etapa as any || 'participacion',
        });
      }

      ip.nivel = etapa as any || 'participacion';
      ip.completado = true;
      ip.fechaCompletado = new Date();
      await this.iniciativaRepo.save(ip);
    } else if (tipo === 'puntaDeFlecha') {
      let pf = await this.puntaRepo.findOne({
        where: {
          caminanteId,
          tipo: etapa as any || 'participacion',
        },
      });

      if (!pf) {
        pf = this.puntaRepo.create({
          caminanteId,
          tipo: etapa as any || 'participacion',
        });
      }

      pf.completado = true;
      pf.fechaCompletado = new Date();
      await this.puntaRepo.save(pf);
    }
  }

  private async actualizarSenderoDesdeEspecialidad(
    caminanteId: number,
    sendero: string,
    camino: string,
    etapa: string,
  ) {
    let sp = await this.senderoRepo.findOne({
      where: { caminanteId, sendero: sendero as any, camino },
    });

    if (!sp) {
      sp = this.senderoRepo.create({
        caminanteId,
        sendero: sendero as any,
        camino,
        completado: false,
      });
    }

    if (etapa === 'conozco') sp.conozco = true;
    if (etapa === 'aplico') sp.aplico = true;
    if (etapa === 'comparto') sp.comparto = true;

    if (sp.conozco && sp.aplico && sp.comparto) {
      sp.completado = true;
      sp.fechaCompletado = new Date();
    }

    await this.senderoRepo.save(sp);
  }

  async findOne(id: number): Promise<Evidencia> {
    const ev = await this.evidenciaRepo.findOne({
      where: { id },
      relations: ['caminante'],
    });
    if (!ev) throw new NotFoundException(`Evidencia #${id} not found`);
    return ev;
  }
}
