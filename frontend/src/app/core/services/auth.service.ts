import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface UserInfo {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

export interface LoginResponse {
  access_token: string;
  user: UserInfo;
}

// ─── Secciones Scout ──────────────────────────────────────────────────────────
export const SECCIONES = [
  { value: 'manada',    label: 'Manada de Lobatos' },
  { value: 'tropa',     label: 'Tropa de Scouts' },
  { value: 'comunidad', label: 'Comunidad de Caminantes' },
  { value: 'clan',      label: 'Clan de Rovers' },
];

export const SECCION_LABEL: Record<string, string> = {
  manada:    'Manada de Lobatos',
  tropa:     'Tropa de Scouts',
  comunidad: 'Comunidad de Caminantes',
  clan:      'Clan de Rovers',
  grupo:     'Grupo Scout',
};

// ─── Mapa de roles ────────────────────────────────────────────────────────────
export const ROL_INFO: Record<string, { label: string; seccion: string }> = {
  // Grupo
  jefe_grupo:          { label: 'Jefe de Grupo',                    seccion: 'grupo' },
  sub_jefe_grupo:      { label: 'Subjefe de Grupo',                  seccion: 'grupo' },
  colaborador_grupo:   { label: 'Colaborador de Grupo',              seccion: 'grupo' },
  contador_grupo:      { label: 'Contador de Grupo',                 seccion: 'grupo' },
  secretario_grupo:    { label: 'Secretario de Grupo',               seccion: 'grupo' },
  // Manada de Lobatos
  jefe_manada:         { label: 'Jefe de Manada de Lobatos',         seccion: 'manada' },
  sub_jefe_manada:     { label: 'Subjefe de Manada de Lobatos',      seccion: 'manada' },
  // Tropa de Scouts
  jefe_tropa:          { label: 'Jefe de Tropa de Scouts',           seccion: 'tropa' },
  sub_jefe_tropa:      { label: 'Subjefe de Tropa de Scouts',        seccion: 'tropa' },
  // Comunidad de Caminantes
  jefe_comunidad:      { label: 'Jefe de Comunidad de Caminantes',   seccion: 'comunidad' },
  sub_jefe_comunidad:  { label: 'Subjefe de Comunidad de Caminantes',seccion: 'comunidad' },
  // Clan de Rovers
  jefe_clan:           { label: 'Jefe de Clan de Rovers',            seccion: 'clan' },
  sub_jefe_clan:       { label: 'Subjefe de Clan de Rovers',         seccion: 'clan' },
  // Joven
  scout:               { label: 'Scout',                             seccion: 'scout' },
};

// ─── Temas por sección ────────────────────────────────────────────────────────
export const SECCION_THEME: Record<string, string> = {
  grupo:     'theme-grupo',
  manada:    'theme-manada',
  tropa:     'theme-tropa',
  comunidad: 'theme-comunidad',
  clan:      'theme-clan',
  scout:     'theme-comunidad',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = '/api/auth';
  private readonly TOKEN_KEY = 'scouts_token';
  private readonly USER_KEY = 'scouts_user';

  private userSubject = new BehaviorSubject<UserInfo | null>(this.loadUser());
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API}/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(this.TOKEN_KEY, res.access_token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
        this.userSubject.next(res.user);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getUser(): UserInfo | null {
    return this.userSubject.value;
  }

  getRolLabel(rol: string): string {
    return ROL_INFO[rol]?.label ?? rol;
  }

  getSeccion(rol: string): string {
    return ROL_INFO[rol]?.seccion ?? 'scout';
  }

  getSeccionLabel(seccion: string): string {
    return SECCION_LABEL[seccion] ?? seccion;
  }

  getThemeClass(rol: string): string {
    const seccion = this.getSeccion(rol);
    return SECCION_THEME[seccion] ?? 'theme-comunidad';
  }

  private loadUser(): UserInfo | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
