import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { TelegramBot, type Message } from 'node-telegram-bot-api';
import { User } from '../users/entities/user.entity';

function generarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  onModuleInit(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado: los recordatorios por Telegram están deshabilitados.');
      return;
    }
    this.bot = new TelegramBot(token, { polling: true });
    this.bot.onText(/\/start(?:\s+(.+))?/, (msg, match) => this.manejarStart(msg, match));
    this.logger.log('Bot de Telegram iniciado (polling).');
  }

  private async manejarStart(msg: Message, match: RegExpExecArray | null): Promise<void> {
    const chatId = msg.chat.id.toString();
    const code = match?.[1]?.trim().toUpperCase();

    if (!code) {
      await this.bot?.sendMessage(chatId, 'Hola 👋 Para vincular tu cuenta, genera un código de vinculación desde la app de Comunidad de Caminantes y abre el enlace que te da.');
      return;
    }

    const usuario = await this.usersRepo.findOne({
      where: { telegramLinkCode: code, telegramLinkCodeExpira: MoreThan(new Date()) },
    });

    if (!usuario) {
      await this.bot?.sendMessage(chatId, 'Ese código no es válido o ya expiró. Genera uno nuevo desde la app.');
      return;
    }

    usuario.telegramChatId = chatId;
    usuario.telegramLinkCode = null;
    usuario.telegramLinkCodeExpira = null;
    await this.usersRepo.save(usuario);

    await this.bot?.sendMessage(chatId, `✅ ¡Listo, ${usuario.nombre}! Tu cuenta quedó vinculada. Desde ahora recibirás aquí los recordatorios de actividades de tu sección.`);
  }

  async generarCodigoVinculacion(userId: number): Promise<{ link: string; code: string }> {
    const code = generarCodigo();
    const expira = new Date(Date.now() + 15 * 60 * 1000);
    await this.usersRepo.update(userId, { telegramLinkCode: code, telegramLinkCodeExpira: expira });
    const username = process.env.TELEGRAM_BOT_USERNAME;
    const link = username ? `https://t.me/${username}?start=${code}` : '';
    return { link, code };
  }

  async estado(userId: number): Promise<{ vinculado: boolean }> {
    const usuario = await this.usersRepo.findOne({ where: { id: userId } });
    return { vinculado: !!usuario?.telegramChatId };
  }

  async desvincular(userId: number): Promise<void> {
    await this.usersRepo.update(userId, { telegramChatId: null });
  }

  async sendToGroup(texto: string): Promise<void> {
    const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
    if (!this.bot || !chatId) return;
    try {
      await this.bot.sendMessage(chatId, texto, { parse_mode: 'Markdown' });
    } catch (err) {
      this.logger.error(`Error enviando mensaje al grupo: ${err}`);
    }
  }

  async sendToUser(chatId: string, texto: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.sendMessage(chatId, texto, { parse_mode: 'Markdown' });
    } catch (err) {
      this.logger.error(`Error enviando mensaje al chat ${chatId}: ${err}`);
    }
  }
}
