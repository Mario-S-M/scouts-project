import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionRecordatorio } from './entities/configuracion-recordatorio.entity';
import { SeccionActividad } from './entities/actividad.entity';
import { ActualizarConfiguracionRecordatorioDto } from './dto/configuracion-recordatorio.dto';
import { puedeGestionarSeccion } from './actividad.service';

const SECCIONES: SeccionActividad[] = ['general', 'manada', 'tropa', 'comunidad', 'clan'];

@Injectable()
export class ConfiguracionRecordatorioService {
  constructor(
    @InjectRepository(ConfiguracionRecordatorio)
    private repo: Repository<ConfiguracionRecordatorio>,
  ) {}

  /** Crea una fila por defecto (miércoles 10:00) para cada ámbito si no existe. */
  async seedDefaults(): Promise<void> {
    for (const seccion of SECCIONES) {
      const existente = await this.repo.findOne({ where: { seccion } });
      if (!existente) {
        await this.repo.save(
          this.repo.create({ seccion, diaSemana: 3, hora: '10:00:00', habilitado: true }),
        );
      }
    }
  }

  findAll(): Promise<ConfiguracionRecordatorio[]> {
    return this.repo.find({ order: { seccion: 'ASC' } });
  }

  async findBySeccion(seccion: SeccionActividad): Promise<ConfiguracionRecordatorio> {
    const config = await this.repo.findOne({ where: { seccion } });
    if (!config) throw new NotFoundException(`Configuración de "${seccion}" no encontrada`);
    return config;
  }

  async update(
    seccion: SeccionActividad,
    dto: ActualizarConfiguracionRecordatorioDto,
    userId: number,
    rol: string,
  ): Promise<ConfiguracionRecordatorio> {
    if (!puedeGestionarSeccion(rol, seccion)) {
      throw new ForbiddenException('No tienes permiso para editar esta configuración');
    }
    const config = await this.findBySeccion(seccion);
    config.diaSemana = dto.diaSemana;
    config.hora = dto.hora.length === 5 ? `${dto.hora}:00` : dto.hora;
    if (dto.habilitado !== undefined) config.habilitado = dto.habilitado;
    config.actualizadoPorId = userId;
    return this.repo.save(config);
  }

  async marcarEnviado(seccion: SeccionActividad, fecha: string): Promise<void> {
    await this.repo.update({ seccion }, { ultimoEnvio: fecha });
  }
}
