import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InsigniaService {
  private baseUrl = '/api/insignias';

  constructor(private http: HttpClient) {}

  getInsignias(caminanteId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${caminanteId}`);
  }

  calcular(caminanteId: number, validadoPor?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${caminanteId}/calcular`, {
      validadoPor,
    });
  }
}
