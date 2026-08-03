import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ConfiguracionRecordatorio,
  ActualizarConfiguracionRecordatorioDto,
} from '../models/configuracion-recordatorio.model';
import { SeccionActividad } from '../models/actividad.model';

@Injectable({ providedIn: 'root' })
export class ConfiguracionRecordatorioService {
  private readonly base = '/api/configuracion-recordatorios';

  constructor(private http: HttpClient) {}

  getAll(): Observable<ConfiguracionRecordatorio[]> {
    return this.http.get<ConfiguracionRecordatorio[]>(this.base);
  }

  update(seccion: SeccionActividad, dto: ActualizarConfiguracionRecordatorioDto): Observable<ConfiguracionRecordatorio> {
    return this.http.put<ConfiguracionRecordatorio>(`${this.base}/${seccion}`, dto);
  }

  probar(seccion: SeccionActividad): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`/api/calendario/recordatorios/probar/${seccion}`, {});
  }
}
