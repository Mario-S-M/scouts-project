import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UsuarioAdmin {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  createdAt: string;
}

export interface UpdateUsuarioDto {
  nombre?: string;
  email?: string;
  password?: string;
  rol?: string;
  activo?: boolean;
}

export interface CreateUsuarioDto {
  nombre: string;
  email: string;
  password: string;
  rol: string;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly API = '/api/usuarios';

  constructor(private http: HttpClient) {}

  getAll(): Observable<UsuarioAdmin[]> {
    return this.http.get<UsuarioAdmin[]>(this.API);
  }

  create(dto: CreateUsuarioDto): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(this.API, dto);
  }

  update(id: number, dto: UpdateUsuarioDto): Observable<UsuarioAdmin> {
    return this.http.patch<UsuarioAdmin>(`${this.API}/${id}`, dto);
  }
}
