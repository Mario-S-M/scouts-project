import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * Permisos por sección. Reglas (acordadas con la jefatura):
 * - administrador: ve y edita todas las secciones (soporte del sistema).
 * - roles de grupo: ven todas las secciones pero no editan datos de sección.
 * - jefe/sub-jefe de sección: ve y edita solo su sección.
 * - scout: solo sus propios datos (rutas /me); nada de listados.
 */
export const ROL_ADMIN = 'administrador';

export const GRUPO_ROLES = [
  'jefe_grupo',
  'sub_jefe_grupo',
  'colaborador_grupo',
  'contador_grupo',
  'secretario_grupo',
];

export const SECCIONES = ['manada', 'tropa', 'comunidad', 'clan'] as const;
export type Seccion = (typeof SECCIONES)[number];

export interface UsuarioToken {
  id: number;
  rol: string;
  nombre?: string;
}

export const esAdmin = (rol?: string) => rol === ROL_ADMIN;
export const esGrupo = (rol?: string) => !!rol && GRUPO_ROLES.includes(rol);

/** Sección que dirige un rol de sección; null para cualquier otro rol */
export function seccionDeRol(rol?: string): Seccion | null {
  const m = /^(?:sub_)?jefe_(manada|tropa|comunidad|clan)$/.exec(rol ?? '');
  return m ? (m[1] as Seccion) : null;
}

/**
 * Compatibilidad: sección de un rol, o null si ve todas (admin y grupo) o no es
 * de sección. Usar `seccionParaVer` en código nuevo: no confunde scout con "todo".
 */
export function getSeccionFromRol(rol: string): string | null {
  return seccionDeRol(rol);
}

/**
 * Sección a la que se limita un listado: null = todas (admin y grupo).
 * Los scouts y roles desconocidos no listan datos de sección.
 */
export function seccionParaVer(user: UsuarioToken): Seccion | null {
  if (esAdmin(user?.rol) || esGrupo(user?.rol)) return null;
  const s = seccionDeRol(user?.rol);
  if (s) return s;
  throw new ForbiddenException('Tu cuenta no tiene acceso a esta información');
}

/** Lanza 403 si el registro es de otra sección (o sin sección) y el usuario no puede verlo */
export function assertPuedeVer(user: UsuarioToken, seccionRecurso: string | null | undefined): void {
  const s = seccionParaVer(user);
  if (s && s !== seccionRecurso) {
    throw new ForbiddenException('Esta información pertenece a otra sección');
  }
}

export function puedeEditar(user: UsuarioToken, seccionRecurso: string | null | undefined): boolean {
  if (esAdmin(user?.rol)) return true;
  const s = seccionDeRol(user?.rol);
  return !!s && s === seccionRecurso;
}

/** Lanza 403 si el usuario no puede modificar datos de esa sección */
export function assertPuedeEditar(user: UsuarioToken, seccionRecurso: string | null | undefined): void {
  if (puedeEditar(user, seccionRecurso)) return;
  if (esGrupo(user?.rol)) {
    throw new ForbiddenException('Los roles de grupo pueden consultar, pero no modificar, la información de las secciones');
  }
  throw new ForbiddenException('No puedes modificar información de otra sección');
}

/**
 * Sección con la que se crea un registro: la del scouter (se ignora la pedida si
 * coincide; si pide otra, 403). El administrador debe indicarla.
 */
export function seccionParaCrear(user: UsuarioToken, seccionPedida?: string | null): Seccion {
  if (esAdmin(user?.rol)) {
    if (!seccionPedida || !(SECCIONES as readonly string[]).includes(seccionPedida)) {
      throw new BadRequestException(`Indica la sección: ${SECCIONES.join(', ')}`);
    }
    return seccionPedida as Seccion;
  }
  const propia = seccionDeRol(user?.rol);
  if (!propia) {
    throw new ForbiddenException(
      esGrupo(user?.rol)
        ? 'Los roles de grupo pueden consultar, pero no modificar, la información de las secciones'
        : 'Tu cuenta no puede crear este registro',
    );
  }
  if (seccionPedida && seccionPedida !== propia) {
    throw new ForbiddenException('Solo puedes crear registros de tu sección');
  }
  return propia;
}
