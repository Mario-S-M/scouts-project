import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Actividad, CrearActividadDto } from '../models/actividad.model';

@Injectable({ providedIn: 'root' })
export class CalendarioService {
  private readonly base = '/api/calendario';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(this.base);
  }

  getByMes(anio: number, mes: number): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(`${this.base}/mes/${anio}/${mes}`);
  }

  create(dto: CrearActividadDto): Observable<Actividad> {
    return this.http.post<Actividad>(this.base, dto);
  }

  update(id: number, dto: CrearActividadDto): Observable<Actividad> {
    return this.http.put<Actividad>(`${this.base}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
