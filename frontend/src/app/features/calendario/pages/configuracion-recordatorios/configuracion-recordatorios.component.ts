import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TelegramService } from '../../../../core/services/telegram.service';
import { ConfiguracionRecordatorioService } from '../../../../core/services/configuracion-recordatorio.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ConfiguracionRecordatorio, DIAS_SEMANA } from '../../../../core/models/configuracion-recordatorio.model';
import { SeccionActividad, SECCIONES_ACTIVIDAD } from '../../../../core/models/actividad.model';

@Component({
  selector: 'app-configuracion-recordatorios',
  templateUrl: './configuracion-recordatorios.component.html',
})
export class ConfiguracionRecordatoriosComponent implements OnInit {
  vinculado = false;
  linkVinculacion = '';
  codigoVinculacion = '';
  cargandoTelegram = false;

  configuraciones: ConfiguracionRecordatorio[] = [];
  loading = false;
  guardandoSeccion: SeccionActividad | null = null;
  probandoSeccion: SeccionActividad | null = null;

  readonly diasSemana = DIAS_SEMANA;
  readonly seccionLabels = Object.fromEntries(SECCIONES_ACTIVIDAD.map((s) => [s.value, s.label]));

  esJefeGrupo = false;

  constructor(
    private telegramSvc: TelegramService,
    private configSvc: ConfiguracionRecordatorioService,
    private auth: AuthService,
    private msg: MessageService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    this.esJefeGrupo = user?.rol === 'jefe_grupo' || user?.rol === 'sub_jefe_grupo';
    this.cargarEstadoTelegram();
    this.cargarConfiguraciones();
  }

  cargarEstadoTelegram(): void {
    this.telegramSvc.estado().subscribe({
      next: (r) => { this.vinculado = r.vinculado; },
    });
  }

  vincularTelegram(): void {
    this.cargandoTelegram = true;
    this.telegramSvc.vincular().subscribe({
      next: (r) => {
        this.linkVinculacion = r.link;
        this.codigoVinculacion = r.code;
        this.cargandoTelegram = false;
      },
      error: () => {
        this.cargandoTelegram = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el enlace de vinculación.' });
      },
    });
  }

  desvincularTelegram(): void {
    this.telegramSvc.desvincular().subscribe({
      next: () => {
        this.vinculado = false;
        this.linkVinculacion = '';
        this.codigoVinculacion = '';
        this.msg.add({ severity: 'success', summary: 'Desvinculado', detail: 'Tu cuenta de Telegram fue desvinculada.' });
      },
    });
  }

  cargarConfiguraciones(): void {
    this.loading = true;
    this.configSvc.getAll().subscribe({
      next: (data) => { this.configuraciones = data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  puedeEditar(config: ConfiguracionRecordatorio): boolean {
    const user = this.auth.getUser();
    if (!user) return false;
    if (this.esJefeGrupo) return true;
    const seccion = this.auth.getSeccion(user.rol);
    return seccion === config.seccion;
  }

  guardar(config: ConfiguracionRecordatorio): void {
    this.guardandoSeccion = config.seccion;
    this.configSvc.update(config.seccion, {
      diaSemana: config.diaSemana,
      hora: config.hora.slice(0, 5),
      habilitado: config.habilitado,
    }).subscribe({
      next: () => {
        this.guardandoSeccion = null;
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: 'Configuración actualizada.' });
      },
      error: () => {
        this.guardandoSeccion = null;
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la configuración.' });
      },
    });
  }

  probar(config: ConfiguracionRecordatorio): void {
    this.probandoSeccion = config.seccion;
    this.configSvc.probar(config.seccion).subscribe({
      next: () => {
        this.probandoSeccion = null;
        this.msg.add({ severity: 'success', summary: 'Enviado', detail: 'Recordatorio de prueba enviado.' });
      },
      error: () => {
        this.probandoSeccion = null;
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo enviar el recordatorio de prueba.' });
      },
    });
  }
}
