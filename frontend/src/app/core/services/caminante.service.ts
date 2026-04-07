import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Caminante, CaminanteProgreso, CreateCaminanteDto } from '../models/caminante.model';

@Injectable({
  providedIn: 'root',
})
export class CaminanteService {
  private baseUrl = '/api/caminantes';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Caminante[]> {
    return this.http.get<Caminante[]>(this.baseUrl);
  }

  getById(id: number): Observable<Caminante> {
    return this.http.get<Caminante>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateCaminanteDto): Observable<Caminante> {
    return this.http.post<Caminante>(this.baseUrl, dto);
  }

  update(id: number, dto: Partial<CreateCaminanteDto>): Observable<Caminante> {
    return this.http.put<Caminante>(`${this.baseUrl}/${id}`, dto);
  }

  getProgreso(id: number): Observable<CaminanteProgreso> {
    return this.http.get<CaminanteProgreso>(`${this.baseUrl}/${id}/progreso`);
  }

  getMe(): Observable<Caminante> {
    return this.http.get<Caminante>(`${this.baseUrl}/me`);
  }

  getMiProgreso(): Observable<CaminanteProgreso> {
    return this.http.get<CaminanteProgreso>(`${this.baseUrl}/me/progreso`);
  }

  getInsignias(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${id}/insignias`);
  }

  uploadFoto(id: number, file: File): Observable<Caminante> {
    const formData = new FormData();
    formData.append('foto', file);
    return this.http.post<Caminante>(`${this.baseUrl}/${id}/foto`, formData);
  }
}
