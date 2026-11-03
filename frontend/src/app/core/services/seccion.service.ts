import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthService, ROL_INFO } from './auth.service';

/** Identidad de una sección (tabla secciones_config del backend) */
export interface SeccionConfig {
  clave: string;
  nombreCompleto: string;
  nombreCorto: string;
  jovenSingular: string;
  jovenPlural: string;
  cargoJefe: string;
  cargoSubjefe: string;
  colorPrincipal: string;
  colorOscuro: string;
  colorAcento: string;
  colorTextoAcento: string;
  logo: string | null;
  progresionHabilitada: boolean;
}

export type Termino = 'singular' | 'plural' | 'Singular' | 'Plural' | 'seccion' | 'corto';

const CACHE_KEY = 'scouts_secciones';
const LOGO_GRUPO = 'assets/images/logo-grupo.png';

/** Respaldo mientras llega la API (mismos valores que el seed del backend) */
const RESPALDO: Record<string, Partial<SeccionConfig>> = {
  grupo: { nombreCompleto: 'Grupo Scout 7', nombreCorto: 'Grupo', jovenSingular: 'joven', jovenPlural: 'jóvenes' },
  manada: { nombreCompleto: 'Manada de Lobatos', nombreCorto: 'Manada', jovenSingular: 'lobato o lobezna', jovenPlural: 'lobatos y lobeznas' },
  tropa: { nombreCompleto: 'Tropa de Scouts', nombreCorto: 'Tropa', jovenSingular: 'scout', jovenPlural: 'scouts' },
  comunidad: { nombreCompleto: 'Comunidad de Caminantes', nombreCorto: 'Comunidad', jovenSingular: 'caminante', jovenPlural: 'caminantes', progresionHabilitada: true },
  clan: { nombreCompleto: 'Clan de Rovers', nombreCorto: 'Clan', jovenSingular: 'rover', jovenPlural: 'rovers' },
};

/**
 * Vocabulario, colores y logo de la sección del usuario. Así ninguna pantalla
 * tiene "caminantes" fijo: Manada ve "lobatos y lobeznas", Tropa "scouts", etc.
 */
@Injectable({ providedIn: 'root' })
export class SeccionService {
  private configs = new BehaviorSubject<Record<string, SeccionConfig>>(this.leerCache());
  configs$ = this.configs.asObservable();

  constructor(private http: HttpClient, private auth: AuthService) {}

  cargar(): Observable<SeccionConfig[]> {
    return this.http.get<SeccionConfig[]>('/api/secciones').pipe(
      tap((lista) => {
        const mapa = Object.fromEntries(lista.map((s) => [s.clave, s]));
        localStorage.setItem(CACHE_KEY, JSON.stringify(mapa));
        this.configs.next(mapa);
        this.aplicarTema();
      }),
    );
  }

  todas(): SeccionConfig[] {
    return Object.values(this.configs.value);
  }

  /** Sección cuya identidad se muestra: la del scouter, la del joven, o "grupo" */
  claveActual(): string {
    const user = this.auth.getUser();
    if (!user) return 'grupo';
    if (user.rol === 'scout') return user.seccion || 'comunidad';
    const s = ROL_INFO[user.rol]?.seccion;
    return s && s !== 'scout' ? s : 'grupo';
  }

  de(clave?: string | null): SeccionConfig {
    const c = clave || this.claveActual();
    return { ...(RESPALDO[c] ?? RESPALDO['grupo']), ...(this.configs.value[c] ?? {}) } as SeccionConfig;
  }

  actual(): SeccionConfig {
    return this.de();
  }

  /** "lobatos y lobeznas", "Lobatos y lobeznas", "Manada de Lobatos"… */
  termino(tipo: Termino, clave?: string | null): string {
    const s = this.de(clave);
    const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
    switch (tipo) {
      case 'singular': return s.jovenSingular;
      case 'plural': return s.jovenPlural;
      case 'Singular': return cap(s.jovenSingular);
      case 'Plural': return cap(s.jovenPlural);
      case 'seccion': return s.nombreCompleto;
      case 'corto': return s.nombreCorto;
    }
  }

  progresion(clave?: string | null): boolean {
    return !!this.de(clave).progresionHabilitada;
  }

  logo(clave?: string | null): string {
    return this.de(clave).logo || LOGO_GRUPO;
  }

  /** Colores de la sección en variables CSS del <body> (navbar y menús) */
  aplicarTema(): void {
    const s = this.configs.value[this.claveActual()];
    const st = document.body.style;
    if (!s) {
      ['--nav-bg', '--nav-bg-dark', '--nav-accent', '--nav-accent-light', '--nav-avatar-bg', '--nav-avatar-text']
        .forEach((v) => st.removeProperty(v));
      return;
    }
    st.setProperty('--nav-bg', s.colorPrincipal);
    st.setProperty('--nav-bg-dark', s.colorOscuro);
    st.setProperty('--nav-accent', s.colorAcento);
    st.setProperty('--nav-accent-light', s.colorAcento);
    st.setProperty('--nav-avatar-bg', s.colorAcento);
    st.setProperty('--nav-avatar-text', s.colorTextoAcento);
  }

  // ── Administración (solo rol administrador) ────────────────────────────────
  actualizar(clave: string, cambios: Partial<SeccionConfig>): Observable<SeccionConfig> {
    return this.http.put<SeccionConfig>(`/api/secciones/${clave}`, cambios);
  }

  subirLogo(clave: string, archivo: File): Observable<SeccionConfig> {
    const fd = new FormData();
    fd.append('logo', archivo);
    return this.http.post<SeccionConfig>(`/api/secciones/${clave}/logo`, fd);
  }

  quitarLogo(clave: string): Observable<SeccionConfig> {
    return this.http.delete<SeccionConfig>(`/api/secciones/${clave}/logo`);
  }

  private leerCache(): Record<string, SeccionConfig> {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch {
      return {};
    }
  }
}
