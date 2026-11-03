import { SeccionConfig } from './seccion-config.entity';

type Semilla = Omit<SeccionConfig, 'updatedAt'>;

/** Valores iniciales (los mismos colores que tenía styles.scss) */
export const SECCIONES_DEFAULT: Semilla[] = [
  {
    clave: 'grupo', nombreCompleto: 'Grupo Scout 7', nombreCorto: 'Grupo',
    jovenSingular: 'joven', jovenPlural: 'jóvenes',
    cargoJefe: 'Jefe de Grupo', cargoSubjefe: 'Subjefe de Grupo',
    colorPrincipal: '#2C2E30', colorOscuro: '#1A1C1E', colorAcento: '#9CA3AF', colorTextoAcento: '#111827',
    logo: null, progresionHabilitada: false,
  },
  {
    clave: 'manada', nombreCompleto: 'Manada de Lobatos', nombreCorto: 'Manada',
    jovenSingular: 'lobato o lobezna', jovenPlural: 'lobatos y lobeznas',
    cargoJefe: 'Jefe de Manada', cargoSubjefe: 'Subjefe de Manada',
    colorPrincipal: '#78350F', colorOscuro: '#451A03', colorAcento: '#F59E0B', colorTextoAcento: '#451A03',
    logo: null, progresionHabilitada: false,
  },
  {
    clave: 'tropa', nombreCompleto: 'Tropa de Scouts', nombreCorto: 'Tropa',
    jovenSingular: 'scout', jovenPlural: 'scouts',
    cargoJefe: 'Jefe de Tropa', cargoSubjefe: 'Subjefe de Tropa',
    colorPrincipal: '#14532D', colorOscuro: '#052E16', colorAcento: '#22C55E', colorTextoAcento: '#052E16',
    logo: null, progresionHabilitada: false,
  },
  {
    clave: 'comunidad', nombreCompleto: 'Comunidad de Caminantes', nombreCorto: 'Comunidad',
    jovenSingular: 'caminante', jovenPlural: 'caminantes',
    cargoJefe: 'Jefe de Comunidad', cargoSubjefe: 'Subjefe de Comunidad',
    colorPrincipal: '#14265C', colorOscuro: '#0B1740', colorAcento: '#EFC02F', colorTextoAcento: '#14265C',
    logo: '/uploads/secciones/comunidad.png', progresionHabilitada: true,
  },
  {
    clave: 'clan', nombreCompleto: 'Clan de Rovers', nombreCorto: 'Clan',
    jovenSingular: 'rover', jovenPlural: 'rovers',
    cargoJefe: 'Jefe de Clan', cargoSubjefe: 'Subjefe de Clan',
    colorPrincipal: '#7F1D1D', colorOscuro: '#450A0A', colorAcento: '#EF4444', colorTextoAcento: '#FFFFFF',
    logo: null, progresionHabilitada: false,
  },
];
