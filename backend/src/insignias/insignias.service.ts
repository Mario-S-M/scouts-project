import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Insignia, TipoInsignia } from './entities/insignia.entity';
import { Camisola } from './entities/camisola.entity';
import { User } from '../users/entities/user.entity';
import { SenderoProgreso } from '../progreso/entities/sendero-progreso.entity';
import { EspecialidadProgreso } from '../progreso/entities/especialidad-progreso.entity';
import { AventuraProgreso } from '../progreso/entities/aventura-progreso.entity';
import { IniciativaProgreso } from '../progreso/entities/iniciativa-progreso.entity';
import { Evento } from '../progreso/entities/evento.entity';
import { PuntaDeFlecha } from '../progreso/entities/punta-de-flecha.entity';

interface RequisitosInsignia {
  senderos: number;
  especialidades: number;
  terraNova: boolean;
  aventurasExtra: number;
  puntaDeFlecha: 'participacion' | 'certificacion';
  iniciativas: number;
  eventos: number;
  meses: number;
}

const REQUISITOS: Record<TipoInsignia, RequisitosInsignia> = {
  Obsidiana: {
    senderos: 3,
    especialidades: 3,
    terraNova: true,
    aventurasExtra: 1,
    puntaDeFlecha: 'participacion',
    iniciativas: 2,
    eventos: 2,
    meses: 18,
  },
  Jade: {
    senderos: 4,
    especialidades: 4,
    terraNova: true,
    aventurasExtra: 2,
    puntaDeFlecha: 'certificacion',
    iniciativas: 3,
    eventos: 3,
    meses: 24,
  },
  Opalo: {
    senderos: 4,
    especialidades: 5,
    terraNova: true,
    aventurasExtra: 3,
    puntaDeFlecha: 'certificacion',
    iniciativas: 4,
    eventos: 4,
    meses: 30,
  },
  Diamante: {
    senderos: 4,
    especialidades: 6,
    terraNova: true,
    aventurasExtra: 3,
    puntaDeFlecha: 'certificacion',
    iniciativas: 5,
    eventos: 5,
    meses: 36,
  },
};

@Injectable()
export class InsigniasService {
  constructor(
    @InjectRepository(Insignia)
    private insigniaRepo: Repository<Insignia>,
    @InjectRepository(Camisola)
    private camisolaRepo: Repository<Camisola>,
    @InjectRepository(User)
    private caminanteRepo: Repository<User>,
    @InjectRepository(SenderoProgreso)
    private senderoRepo: Repository<SenderoProgreso>,
    @InjectRepository(EspecialidadProgreso)
    private especialidadRepo: Repository<EspecialidadProgreso>,
    @InjectRepository(AventuraProgreso)
    private aventuraRepo: Repository<AventuraProgreso>,
    @InjectRepository(IniciativaProgreso)
    private iniciativaRepo: Repository<IniciativaProgreso>,
    @InjectRepository(Evento)
    private eventoRepo: Repository<Evento>,
    @InjectRepository(PuntaDeFlecha)
    private puntaRepo: Repository<PuntaDeFlecha>,
  ) {}

  async getInsignias(caminanteId: number) {
    const insignias = await this.insigniaRepo.find({
      where: { caminanteId },
    });

    const allTypes: TipoInsignia[] = ['Obsidiana', 'Jade', 'Opalo', 'Diamante'];
    return allTypes.map((tipo) => {
      const found = insignias.find((i) => i.tipo === tipo);
      return {
        tipo,
        otorgada: found?.otorgada || false,
        fechaOtorgada: found?.fechaOtorgada || null,
        validadoPor: found?.validadoPor || null,
      };
    });
  }

  async calcularInsignias(caminanteId: number, validadoPor?: string) {
    const caminante = await this.caminanteRepo.findOne({
      where: { id: caminanteId },
    });
    if (!caminante) return { error: 'Caminante not found' };

    // Gather all data
    const senderos = await this.senderoRepo.find({ where: { caminanteId } });
    const especialidades = await this.especialidadRepo.find({
      where: { caminanteId },
    });
    const aventuras = await this.aventuraRepo.find({ where: { caminanteId } });
    const iniciativas = await this.iniciativaRepo.find({
      where: { caminanteId },
    });
    const eventos = await this.eventoRepo.find({ where: { caminanteId } });
    const puntas = await this.puntaRepo.find({ where: { caminanteId } });

    // Compute progress
    const senderosCompletadosCount = this.countSenderosCompletos(senderos);
    const especialidadesCompletas = especialidades.filter((e) => e.completado).length;
    const terraNova = aventuras.find(
      (a) => a.aventura === 'TerraNova' && a.completado,
    );
    const otrasAventuras = aventuras.filter(
      (a) => a.aventura !== 'TerraNova' && a.completado,
    ).length;
    const iniciativasCompletas = iniciativas.filter((i) => i.completado).length;
    const eventosTotal = eventos.length;
    const puntaParticipacion = puntas.find(
      (p) => p.tipo === 'participacion' && p.completado,
    );
    const puntaCertificacion = puntas.find(
      (p) => p.tipo === 'certificacion' && p.completado,
    );

    let mesesEnPrograma = 0;
    if (caminante.fechaPaseInicio) {
      const inicio = new Date(caminante.fechaPaseInicio);
      const ahora = new Date();
      mesesEnPrograma =
        (ahora.getFullYear() - inicio.getFullYear()) * 12 +
        (ahora.getMonth() - inicio.getMonth());
    }

    const results = [];
    let highestEarned: TipoInsignia = null;

    for (const [tipo, req] of Object.entries(REQUISITOS) as [
      TipoInsignia,
      RequisitosInsignia,
    ][]) {
      const cumpleSenderos = senderosCompletadosCount >= req.senderos;
      const cumpleEspecialidades = especialidadesCompletas >= req.especialidades;
      const cumpleTerraNova = !req.terraNova || !!terraNova;
      const cumpleAventuras = otrasAventuras >= req.aventurasExtra;
      const cumplePunta =
        req.puntaDeFlecha === 'participacion'
          ? !!puntaParticipacion || !!puntaCertificacion
          : !!puntaCertificacion;
      const cumpleIniciativas = iniciativasCompletas >= req.iniciativas;
      const cumpleEventos = eventosTotal >= req.eventos;
      const cumpleMeses = mesesEnPrograma >= req.meses;

      const cumple =
        cumpleSenderos &&
        cumpleEspecialidades &&
        cumpleTerraNova &&
        cumpleAventuras &&
        cumplePunta &&
        cumpleIniciativas &&
        cumpleEventos &&
        cumpleMeses;

      // Upsert insignia
      let insignia = await this.insigniaRepo.findOne({
        where: { caminanteId, tipo },
      });

      if (!insignia) {
        insignia = this.insigniaRepo.create({ caminanteId, tipo });
      }

      if (cumple && !insignia.otorgada) {
        insignia.otorgada = true;
        insignia.fechaOtorgada = new Date();
        insignia.validadoPor = validadoPor || 'Sistema';
        highestEarned = tipo;
      }

      await this.insigniaRepo.save(insignia);

      results.push({
        tipo,
        cumple,
        otorgada: insignia.otorgada,
        detalles: {
          senderos: { cumple: cumpleSenderos, valor: senderosCompletadosCount, req: req.senderos },
          especialidades: { cumple: cumpleEspecialidades, valor: especialidadesCompletas, req: req.especialidades },
          terraNova: { cumple: cumpleTerraNova, valor: !!terraNova },
          aventuras: { cumple: cumpleAventuras, valor: otrasAventuras, req: req.aventurasExtra },
          puntaDeFlecha: { cumple: cumplePunta, tipo: req.puntaDeFlecha },
          iniciativas: { cumple: cumpleIniciativas, valor: iniciativasCompletas, req: req.iniciativas },
          eventos: { cumple: cumpleEventos, valor: eventosTotal, req: req.eventos },
          meses: { cumple: cumpleMeses, valor: mesesEnPrograma, req: req.meses },
        },
      });
    }

    // Award camisola if Jade or higher
    const jadeOtorgada = await this.insigniaRepo.findOne({
      where: { caminanteId, tipo: 'Jade', otorgada: true },
    });

    if (jadeOtorgada) {
      let camisola = await this.camisolaRepo.findOne({ where: { caminanteId } });
      if (!camisola) {
        camisola = this.camisolaRepo.create({
          caminanteId,
          otorgada: true,
          fechaOtorgada: new Date(),
        });
        await this.camisolaRepo.save(camisola);
      }
    }

    return {
      caminanteId,
      insignias: results,
      camisola: !!jadeOtorgada,
    };
  }

  private countSenderosCompletos(senderos: SenderoProgreso[]): number {
    const senderosMap = new Map<string, SenderoProgreso[]>();
    for (const s of senderos) {
      if (!senderosMap.has(s.sendero)) senderosMap.set(s.sendero, []);
      senderosMap.get(s.sendero).push(s);
    }

    let count = 0;
    for (const [, caminos] of senderosMap) {
      // A sendero is complete when all 5 caminos are completed
      const completados = caminos.filter((c) => c.completado).length;
      if (completados >= 5) count++;
    }
    return count;
  }
}
