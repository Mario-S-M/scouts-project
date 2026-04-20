import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CicloPrograma, CrearCicloDto, ActividadCiclo } from '../models/ciclo-programa.model';

@Injectable({ providedIn: 'root' })
export class CicloProgramaService {
  private readonly base = '/api/ciclos-programa';

  constructor(private http: HttpClient) {}

  getAll(): Observable<CicloPrograma[]> {
    return this.http.get<CicloPrograma[]>(this.base);
  }

  getOne(id: number): Observable<CicloPrograma> {
    return this.http.get<CicloPrograma>(`${this.base}/${id}`);
  }

  create(dto: CrearCicloDto): Observable<CicloPrograma> {
    return this.http.post<CicloPrograma>(this.base, dto);
  }

  update(id: number, dto: CrearCicloDto): Observable<CicloPrograma> {
    return this.http.put<CicloPrograma>(`${this.base}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getActividadesMes(seccion: string, anio: number, mes: number): Observable<ActividadCiclo[]> {
    return this.http.get<ActividadCiclo[]>(`${this.base}/actividades-mes/${seccion}/${anio}/${mes}`);
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }

  previewPdf(dto: CrearCicloDto): Observable<Blob> {
    return this.http.post(`${this.base}/pdf-preview`, dto, { responseType: 'blob' });
  }
}
