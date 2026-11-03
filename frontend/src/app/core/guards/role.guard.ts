import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROLES_JEFE_SECCION } from '../models/solicitud-insignias.model';

@Injectable({ providedIn: 'root' })
export class JefeGrupoGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.authService.getUser();
    if (user?.rol === 'jefe_grupo') return true;
    this.router.navigate(['/']);
    return false;
  }
}

/**
 * Deja pasar a los nueve roles que pueden administrar el catálogo y las
 * solicitudes de insignias: jefe de grupo y jefe / subjefe de cada sección.
 * Al resto —scouts y roles de grupo sin mando de sección— lo manda al inicio.
 */
@Injectable({ providedIn: 'root' })
export class JefeSeccionGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.authService.getUser();
    if (user && ROLES_JEFE_SECCION.includes(user.rol)) return true;
    this.router.navigate(['/']);
    return false;
  }
}
