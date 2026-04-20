import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  InformeMensual, CrearInformeDto, InventarioItem,
  AltaBaja, AsistenciaActividad, ActividadPendiente,
  MovimientoFinanciero, ProgresionInforme,
} from '../models/informe.model';

@Injectable({ providedIn: 'root' })
export class InformeService {
  private readonly base = '/api/informes';

  constructor(private http: HttpClient) {}

  /** Último informe guardado de una sección con saldoActual calculado */
  getUltimo(seccion: string): Observable<(InformeMensual & { saldoActual: number }) | null> {
    return this.http.get<(InformeMensual & { saldoActual: number }) | null>(`${this.base}/ultimo/${seccion}`);
  }

  getAll(): Observable<InformeMensual[]> {
    return this.http.get<InformeMensual[]>(this.base);
  }

  getOne(id: number): Observable<InformeMensual> {
    return this.http.get<InformeMensual>(`${this.base}/${id}`);
  }

  create(dto: CrearInformeDto): Observable<InformeMensual> {
    return this.http.post<InformeMensual>(this.base, dto);
  }

  update(id: number, dto: CrearInformeDto): Observable<InformeMensual> {
    return this.http.put<InformeMensual>(`${this.base}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: 'blob' });
  }

  // ── Partial updates (auto-save por tab) ──────────────────────────────────────
  patchConfig(id: number, data: { mes: number; anio: number; saldoInicial: number; observacionesGenerales?: string }): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/config`, data);
  }

  patchMembresia(id: number, data: { totalRegistrados: number; totalEnlace: number; totalCaptacion: number; totalNoRegistrados: number; altasBajas: AltaBaja[] }): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/membresia`, data);
  }

  patchActividades(id: number, data: { actividades: AsistenciaActividad[]; actividadesPendientes: ActividadPendiente[] }): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/actividades`, data);
  }

  patchFinanciero(id: number, data: { saldoInicial: number; movimientos: MovimientoFinanciero[] }): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/financiero`, data);
  }

  patchProgresion(id: number, data: { progresiones: ProgresionInforme[]; observacionesGenerales?: string }): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/progresion`, data);
  }

  getCatalogoProgresion(): Observable<{ ejeTematico: string; nombre: string }[]> {
    return this.http.get<{ ejeTematico: string; nombre: string }[]>(`${this.base}/catalogo/progresion`);
  }

  // Inventario
  getInventario(seccion: string): Observable<InventarioItem[]> {
    return this.http.get<InventarioItem[]>(`${this.base}/inventario/${seccion}`);
  }

  createInventarioItem(item: InventarioItem): Observable<InventarioItem> {
    return this.http.post<InventarioItem>(`${this.base}/inventario`, item);
  }

  updateInventarioItem(id: number, item: InventarioItem): Observable<InventarioItem> {
    return this.http.put<InventarioItem>(`${this.base}/inventario/${id}`, item);
  }

  deleteInventarioItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/inventario/${id}`);
  }
}
