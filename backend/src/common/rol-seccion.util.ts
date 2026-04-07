export const GRUPO_ROLES = [
  'jefe_grupo',
  'sub_jefe_grupo',
  'colaborador_grupo',
  'contador_grupo',
  'secretario_grupo',
];

/**
 * Returns the section a role manages, or null if the role can see all sections
 * (grupo roles) or has no section-based access.
 */
export function getSeccionFromRol(rol: string): string | null {
  if (GRUPO_ROLES.includes(rol)) return null;
  if (['jefe_manada', 'sub_jefe_manada'].includes(rol)) return 'manada';
  if (['jefe_tropa', 'sub_jefe_tropa'].includes(rol)) return 'tropa';
  if (['jefe_comunidad', 'sub_jefe_comunidad'].includes(rol)) return 'comunidad';
  if (['jefe_clan', 'sub_jefe_clan'].includes(rol)) return 'clan';
  return null;
}
