import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CatalogoInsignia,
  CrearCatalogoInsigniaDto,
  ActualizarCatalogoInsigniaDto,
  SolicitudInsignias,
  CrearSolicitudInsigniasDto,
  ActualizarSolicitudInsigniasDto,
} from '../models/solicitud-insignias.model';

/**
 * Cliente de los endpoints de catálogo y solicitudes de insignias.
 * Los dos controllers del backend cuelgan de /api/insignias con prefijo propio
 * (insignias/catalogo e insignias/solicitudes) para no chocar con el
 * @Get(':caminanteId') de InsigniasController.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudesInsigniasService {
  private readonly catalogoUrl = '/api/insignias/catalogo';
  private readonly solicitudesUrl = '/api/insignias/solicitudes';

  constructor(private http: HttpClient) {}

  // ── Catálogo ───────────────────────────────────────────────────────────────

  /**
   * Lista los ítems del catálogo. Por defecto solo los activos; con
   * `incluirInactivos = true` devuelve también los dados de baja.
   */
  getCatalogo(incluirInactivos = false): Observable<CatalogoInsignia[]> {
    let params = new HttpParams();
    if (incluirInactivos) {
      params = params.set('incluirInactivos', 'true');
    }
    return this.http.get<CatalogoInsignia[]>(this.catalogoUrl, { params });
  }

  /** Alta de un ítem del catálogo */
  crearCatalogoItem(dto: CrearCatalogoInsigniaDto): Observable<CatalogoInsignia> {
    return this.http.post<CatalogoInsignia>(this.catalogoUrl, dto);
  }

  /** Edición de un ítem del catálogo */
  actualizarCatalogoItem(
    id: number,
    dto: ActualizarCatalogoInsigniaDto,
  ): Observable<CatalogoInsignia> {
    return this.http.put<CatalogoInsignia>(`${this.catalogoUrl}/${id}`, dto);
  }

  /** Borrado lógico: el backend deja la fila con activo = false */
  eliminarCatalogoItem(id: number): Observable<void> {
    return this.http.delete<void>(`${this.catalogoUrl}/${id}`);
  }

  // ── Solicitudes ────────────────────────────────────────────────────────────

  /**
   * Listado de solicitudes. El backend ya filtra por sección según el rol del
   * usuario; los roles de grupo las ven todas.
   */
  getSolicitudes(): Observable<SolicitudInsignias[]> {
    return this.http.get<SolicitudInsignias[]>(this.solicitudesUrl);
  }

  /** Detalle de una solicitud con sus líneas */
  getSolicitud(id: number): Observable<SolicitudInsignias> {
    return this.http.get<SolicitudInsignias>(`${this.solicitudesUrl}/${id}`);
  }

  /** Alta de una solicitud */
  crearSolicitud(dto: CrearSolicitudInsigniasDto): Observable<SolicitudInsignias> {
    return this.http.post<SolicitudInsignias>(this.solicitudesUrl, dto);
  }

  /** Edición de una solicitud; el backend reemplaza sus líneas */
  actualizarSolicitud(
    id: number,
    dto: ActualizarSolicitudInsigniasDto,
  ): Observable<SolicitudInsignias> {
    return this.http.put<SolicitudInsignias>(`${this.solicitudesUrl}/${id}`, dto);
  }

  /** Borra la solicitud; sus líneas caen por CASCADE */
  eliminarSolicitud(id: number): Observable<void> {
    return this.http.delete<void>(`${this.solicitudesUrl}/${id}`);
  }

  /**
   * Ids del catálogo que el caminante ya tiene ganados según su progreso.
   * Cintas, cordón y kit nunca se sugieren.
   */
  getSugerencias(caminanteId: number): Observable<number[]> {
    return this.http.get<number[]>(
      `${this.solicitudesUrl}/sugerencias/${caminanteId}`,
    );
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  /** Descarga el PDF de una solicitud guardada */
  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.solicitudesUrl}/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  /** Genera el PDF de una solicitud sin guardarla */
  previewPdf(dto: CrearSolicitudInsigniasDto): Observable<Blob> {
    return this.http.post(`${this.solicitudesUrl}/pdf-preview`, dto, {
      responseType: 'blob',
    });
  }
}
