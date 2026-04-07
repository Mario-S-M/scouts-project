import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StaffContacto {
  id: number;
  nombre: string;
  rol: string;
}

export interface AvisoResumen {
  id: number;
  tipo: string;
  nombre: string;
  fechaSalida: string;
  creadoPorNombre: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AvisoService {
  private readonly BASE = '/api/avisos-salida';

  constructor(private http: HttpClient) {}

  getStaff(): Observable<StaffContacto[]> {
    return this.http.get<StaffContacto[]>(`${this.BASE}/staff`);
  }

  getAll(): Observable<AvisoResumen[]> {
    return this.http.get<AvisoResumen[]>(this.BASE);
  }

  save(dto: any): Observable<AvisoResumen> {
    return this.http.post<AvisoResumen>(this.BASE, dto);
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.BASE}/${id}/pdf`, { responseType: 'blob' });
  }

  generatePdf(dto: any): Observable<Blob> {
    return this.http.post(`${this.BASE}/pdf`, dto, { responseType: 'blob' });
  }

  getOne(id: number): Observable<any> {
    return this.http.get<any>(`${this.BASE}/${id}`);
  }

  update(id: number, dto: any): Observable<AvisoResumen> {
    return this.http.put<AvisoResumen>(`${this.BASE}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.BASE}/${id}`);
  }
}
