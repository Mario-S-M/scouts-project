import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { Evidencia } from '../evidencias/entities/evidencia.entity';
import { Insignia } from '../insignias/entities/insignia.entity';
import { SenderoProgreso } from '../progreso/entities/sendero-progreso.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Evidencia)
    private evidenciaRepo: Repository<Evidencia>,
    @InjectRepository(Insignia)
    private insigniaRepo: Repository<Insignia>,
    @InjectRepository(SenderoProgreso)
    private senderoRepo: Repository<SenderoProgreso>,
  ) {}

  async getStats(seccion?: string) {
    const scoutWhere: any = { rol: UserRole.SCOUT };
    if (seccion) scoutWhere.seccion = seccion;

    const totalCaminantes = await this.userRepo.count({ where: scoutWhere });

    // Helper: evidencia query filtered by section when needed
    const evBase = () => {
      const q = this.evidenciaRepo
        .createQueryBuilder('e')
        .innerJoin('e.caminante', 'c');
      if (seccion) q.where('c.seccion = :seccion', { seccion });
      return q;
    };

    const totalEvidencias      = await evBase().getCount();
    const evidenciasPendientes = await evBase().andWhere('e.estado = :s', { s: 'pendiente' }).getCount();
    const evidenciasAprobadas  = await evBase().andWhere('e.estado = :s', { s: 'aprobada' }).getCount();
    const evidenciasRechazadas = await evBase().andWhere('e.estado = :s', { s: 'rechazada' }).getCount();

    // Helper: insignia query filtered by section when needed
    const insBase = () => {
      const q = this.insigniaRepo
        .createQueryBuilder('i')
        .innerJoin('i.caminante', 'c')
        .where('i.otorgada = true');
      if (seccion) q.andWhere('c.seccion = :seccion', { seccion });
      return q;
    };

    const insigniasOtorgadas    = await insBase().getCount();
    const obsidianasOtorgadas   = await insBase().andWhere('i.tipo = :t', { t: 'Obsidiana' }).getCount();
    const jadesOtorgadas        = await insBase().andWhere('i.tipo = :t', { t: 'Jade' }).getCount();
    const opalosOtorgados       = await insBase().andWhere('i.tipo = :t', { t: 'Opalo' }).getCount();
    const diamantesOtorgados    = await insBase().andWhere('i.tipo = :t', { t: 'Diamante' }).getCount();

    // Recent caminantes
    const recentCaminantes = await this.userRepo.find({
      where: scoutWhere,
      order: { createdAt: 'DESC' },
      take: 5,
    });

    // Recent evidencias (filtered by section)
    const recentEvQuery = this.evidenciaRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.caminante', 'c')
      .orderBy('e.fechaSubida', 'DESC')
      .take(10);
    if (seccion) recentEvQuery.where('c.seccion = :seccion', { seccion });
    const recentEvidencias = await recentEvQuery.getMany();

    // Sendero completion stats (filtered by section)
    const senderoBase = () => {
      const q = this.senderoRepo
        .createQueryBuilder('s')
        .innerJoin('s.caminante', 'c')
        .where('s.completado = true');
      if (seccion) q.andWhere('c.seccion = :seccion', { seccion });
      return q;
    };

    const senderosCompletados = await senderoBase().getCount();

    return {
      totalCaminantes,
      evidencias: {
        total: totalEvidencias,
        pendientes: evidenciasPendientes,
        aprobadas: evidenciasAprobadas,
        rechazadas: evidenciasRechazadas,
      },
      insignias: {
        total: insigniasOtorgadas,
        Obsidiana: obsidianasOtorgadas,
        Jade: jadesOtorgadas,
        Opalo: opalosOtorgados,
        Diamante: diamantesOtorgados,
      },
      senderosCompletados,
      recentCaminantes,
      recentEvidencias,
    };
  }
}
