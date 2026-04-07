import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Evidencia, CreateEvidenciaDto, ValidarEvidenciaDto } from '../models/evidencia.model';

@Injectable({
  providedIn: 'root',
})
export class EvidenciaService {
  private baseUrl = '/api/evidencias';

  constructor(private http: HttpClient) {}

  getAll(caminanteId?: number): Observable<Evidencia[]> {
    let params = new HttpParams();
    if (caminanteId) {
      params = params.set('caminanteId', caminanteId.toString());
    }
    return this.http.get<Evidencia[]>(this.baseUrl, { params });
  }

  getPendientes(): Observable<Evidencia[]> {
    return this.http.get<Evidencia[]>(`${this.baseUrl}/pendientes`);
  }

  getById(id: number): Observable<Evidencia> {
    return this.http.get<Evidencia>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateEvidenciaDto, file?: File): Observable<Evidencia> {
    const formData = new FormData();
    formData.append('caminanteId', dto.caminanteId.toString());
    formData.append('tipo', dto.tipo);
    formData.append('categoria', dto.categoria);
    if (dto.subcategoria) formData.append('subcategoria', dto.subcategoria);
    if (dto.etapa) formData.append('etapa', dto.etapa);
    if (dto.descripcion) formData.append('descripcion', dto.descripcion);
    if (file) formData.append('archivo', file);
    return this.http.post<Evidencia>(this.baseUrl, formData);
  }

  validar(id: number, dto: ValidarEvidenciaDto): Observable<Evidencia> {
    return this.http.put<Evidencia>(`${this.baseUrl}/${id}/validar`, dto);
  }
}
