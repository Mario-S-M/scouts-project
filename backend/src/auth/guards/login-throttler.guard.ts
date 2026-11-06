import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { normalizarCorreo } from '../../common/normalizar-correo';

/**
 * Límite de intentos del login contado por IP + correo: una reunión en el mismo Wi-Fi
 * no se bloquea entre sí. La IP sale solo de req.ip (respeta trust proxy); nunca de
 * cabeceras como CF-Connecting-IP o X-Forwarded-For, que se pueden falsificar.
 * El correo se normaliza aquí porque el guard corre antes del ValidationPipe.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // La versión base agrupa las IPv6 por subred para que no se pueda rotar de dirección
    const ip = await super.getTracker(req);
    const email = req.body?.email;
    const correo = typeof email === 'string' ? normalizarCorreo(email).slice(0, 254) : '';
    return `${ip}|${correo}`;
  }
}
