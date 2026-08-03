import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActividadService } from './actividad.service';
import { ConfiguracionRecordatorioService } from './configuracion-recordatorio.service';
import { TelegramService } from '../telegram/telegram.service';
import { User } from '../users/entities/user.entity';
import { Actividad, SeccionActividad } from './entities/actividad.entity';
import { getSeccionFromRol } from '../common/rol-seccion.util';

const DIAS_VENTANA = 7;

const NOMBRES_SECCION: Record<SeccionActividad, string> = {
  general: 'General',
  manada: 'Manada',
  tropa: 'Tropa',
  comunidad: 'Comunidad de Caminantes',
  clan: 'Clan',
};

const EMOJI_SECCION: Record<SeccionActividad, string> = {
  general: '📢',
  manada: '🐺',
  tropa: '🏕️',
  comunidad: '🧭',
  clan: '🛶',
};

@Injectable()
export class RecordatoriosService {
  private readonly logger = new Logger(RecordatoriosService.name);

  constructor(
    private actividadService: ActividadService,
    private configService: ConfiguracionRecordatorioService,
    private telegramService: TelegramService,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async revisarRecordatorios(): Promise<void> {
    const ahora = new Date();
    const hoyIso = ahora.toISOString().slice(0, 10);
    const configs = await this.configService.findAll();

    for (const config of configs) {
      if (!config.habilitado) continue;
      if (config.ultimoEnvio === hoyIso) continue;
      if (ahora.getDay() !== config.diaSemana) continue;

      const [horaCfg, minCfg] = config.hora.split(':').map(Number);
      if (ahora.getHours() !== horaCfg || ahora.getMinutes() !== minCfg) continue;

      await this.enviarRecordatorio(config.seccion, hoyIso);
    }
  }

  async enviarRecordatorio(seccion: SeccionActividad, hoyIso = new Date().toISOString().slice(0, 10)): Promise<void> {
    const actividades = await this.actividadService.findProximas(seccion, DIAS_VENTANA);
    const mensaje = this.armarMensaje(seccion, actividades);

    if (seccion === 'general') {
      await this.telegramService.sendToGroup(mensaje);
    } else {
      const chatIds = await this.chatIdsDeSeccion(seccion);
      for (const chatId of chatIds) {
        await this.telegramService.sendToUser(chatId, mensaje);
      }
    }

    await this.configService.marcarEnviado(seccion, hoyIso);
    this.logger.log(`Recordatorio de "${seccion}" enviado.`);
  }

  private armarMensaje(seccion: SeccionActividad, actividades: Actividad[]): string {
    const encabezado = `${EMOJI_SECCION[seccion]} *Recordatorio de Actividades*\n_${NOMBRES_SECCION[seccion]} — Grupo 7 Itsï Tarhiata_`;

    if (actividades.length === 0) {
      return `${encabezado}\n\n🌿 No hay actividades programadas para los próximos ${DIAS_VENTANA} días.`;
    }

    const lineas = actividades.map((a) => {
      const fecha = new Date(`${a.fecha}T12:00:00`).toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
      const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);
      const hora = a.hora ? `\n🕒 ${a.hora.slice(0, 5)} hrs` : '';
      const lugar = a.lugar ? `\n📍 ${a.lugar}` : '';
      const descripcion = a.descripcion ? `\n💬 ${a.descripcion}` : '';
      return `🎯 *${a.titulo}*\n🗓️ ${fechaCap}${hora}${lugar}${descripcion}`;
    });

    return `${encabezado}\n\n${lineas.join('\n\n➖➖➖➖➖\n\n')}`;
  }

  private async chatIdsDeSeccion(seccion: SeccionActividad): Promise<string[]> {
    const usuarios = await this.usersRepo.find();
    return usuarios
      .filter(
        (u) =>
          !!u.telegramChatId &&
          (getSeccionFromRol(u.rol) === seccion || (u.rol === 'scout' && u.seccion === seccion)),
      )
      .map((u) => u.telegramChatId);
  }
}
