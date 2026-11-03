import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActividadService, seccionesDe } from './actividad.service';
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
    const paraScouters = await this.actividadService.findProximas(seccion, DIAS_VENTANA);

    if (seccion === 'general') {
      // El chat de grupo puede incluir jóvenes: sin actividades "solo scouters"
      const publicas = await this.actividadService.findProximas(seccion, DIAS_VENTANA, true);
      await this.telegramService.sendToGroup(this.armarMensaje(seccion, publicas));
    } else {
      // Scouters: todo; jóvenes: sin "solo scouters"
      const paraJovenes = await this.actividadService.findProximas(seccion, DIAS_VENTANA, true);
      const { scouters, jovenes } = await this.chatIdsDeSeccion(seccion);
      for (const chatId of scouters) await this.telegramService.sendToUser(chatId, this.armarMensaje(seccion, paraScouters));
      for (const chatId of jovenes) await this.telegramService.sendToUser(chatId, this.armarMensaje(seccion, paraJovenes));
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

  private async chatIdsDeSeccion(seccion: SeccionActividad): Promise<{ scouters: string[]; jovenes: string[] }> {
    const usuarios = (await this.usersRepo.find()).filter((u) => !!u.telegramChatId && u.activo !== false);
    return {
      scouters: usuarios.filter((u) => getSeccionFromRol(u.rol) === seccion).map((u) => u.telegramChatId),
      jovenes: usuarios.filter((u) => u.rol === 'scout' && u.seccion === seccion).map((u) => u.telegramChatId),
    };
  }

  /**
   * Tras registrar las actividades de una reunión: a cada scouter le llega por
   * Telegram lo que le toca (su sección y todo el grupo; administración y roles
   * de grupo, todo). Devuelve a quién le llegó y a quién no.
   */
  async notificarScouters(ids: number[]): Promise<{
    enviados: { nombre: string; actividades: number }[];
    sinTelegram: string[];
    fallidos: string[];
    botActivo: boolean;
  }> {
    const actividades = await this.actividadService.findByIds(ids);
    const staff = (await this.usersRepo.find()).filter((u) => u.rol !== 'scout' && u.activo !== false);
    const res = { enviados: [] as { nombre: string; actividades: number }[], sinTelegram: [] as string[], fallidos: [] as string[], botActivo: this.telegramService.activo };
    for (const u of staff) {
      const propia = getSeccionFromRol(u.rol);
      const suyas = actividades.filter((a) => {
        const secs = seccionesDe(a);
        return !propia || secs.includes('grupo') || secs.includes(propia);
      });
      if (!suyas.length) continue;
      if (!u.telegramChatId) { res.sinTelegram.push(u.nombre); continue; }
      const ok = await this.telegramService.enviar(u.telegramChatId, this.armarResumen(u.nombre, suyas));
      if (ok) res.enviados.push({ nombre: u.nombre, actividades: suyas.length });
      else res.fallidos.push(u.nombre);
    }
    return res;
  }

  /** Scouters que aún no vinculan Telegram */
  async scoutersSinTelegram(): Promise<{ nombre: string; rol: string }[]> {
    return (await this.usersRepo.find())
      .filter((u) => u.rol !== 'scout' && u.activo !== false && !u.telegramChatId)
      .map((u) => ({ nombre: u.nombre, rol: u.rol }));
  }

  private armarResumen(nombre: string, actividades: Actividad[]): string {
    const TIPO: Record<string, string> = { consejo: '🧭', salida: '🏕️', pase: '🎖️', grupal: '🤝', reunion: '📌' };
    const quien = (a: Actividad) => {
      const secs = seccionesDe(a);
      return secs.includes('grupo') ? 'Todo el grupo' : secs.map((x) => NOMBRES_SECCION[x as SeccionActividad] ?? x).join(', ');
    };
    const lineas = actividades.map((a) => {
      const fecha = new Date(`${a.fecha}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
      const hora = a.hora ? ` · ${a.hora.slice(0, 5)} hrs` : '';
      const lugar = a.lugar ? `\n📍 ${a.lugar}` : '';
      const oculta = a.visibilidad === 'scouters' ? '\n🔒 Solo scouters' : '';
      return `${TIPO[a.tipo] ?? '📌'} *${a.titulo}*\n🗓️ ${fecha.charAt(0).toUpperCase() + fecha.slice(1)}${hora}\n👥 ${quien(a)}${lugar}${oculta}`;
    });
    return `⚜️ *Actividades de la reunión*\nHola ${nombre.split(' ')[0]}, esto quedó en el calendario:\n\n${lineas.join('\n\n')}`;
  }
}
