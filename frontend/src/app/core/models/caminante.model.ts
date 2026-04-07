export interface Caminante {
  id: number;
  nombre: string;
  apellidos?: string;
  email?: string;
  rol: string;
  activo: boolean;
  seccion?: string;
  grupo?: string;
  provincia?: string;
  comunidad?: string;
  equipo?: string;
  cum?: string;
  fechaNacimiento?: string;
  fechaPromesa?: string;
  fechaPaseInicio?: string;
  foto?: string;
  createdAt: string;
}

export interface CaminanteProgreso {
  caminanteId: number;
  nombre: string;
  senderos: SenderoProgress[];
  senderosCompletados: number;
  especialidades: EspecialidadProgress[];
  especialidadesCompletadas: number;
  aventuras: AventuraProgress[];
  terraNova: boolean;
  otrasAventuras: number;
  iniciativas: IniciativaProgress[];
  iniciativasCompletadas: number;
  eventos: Evento[];
  eventosProvincia: number;
  eventosNacional: number;
  eventosInternacional: number;
  totalEventos: number;
  puntaParticipacion: boolean;
  puntaCertificacion: boolean;
  mesesEnPrograma: number;
  insignias: InsigniaProgress[];
}

export interface SenderoProgress {
  sendero: string;
  total: number;
  completados: number;
  porcentaje: number;
  caminos: CaminoProgress[];
}

export interface CaminoProgress {
  camino: string;
  conozco: boolean;
  aplico: boolean;
  comparto: boolean;
  completado: boolean;
  fechaCompletado?: string;
}

export interface EspecialidadProgress {
  id: number;
  especialidad: string;
  nombre: string;
  senderoArea?: string;
  conozco: boolean;
  aplico: boolean;
  comparto: boolean;
  completado: boolean;
}

export interface AventuraProgress {
  aventura: string;
  completado: boolean;
  fechaCompletado?: string;
}

export interface IniciativaProgress {
  iniciativa: string;
  nivel: string;
  completado: boolean;
}

export interface Evento {
  id: number;
  tipo: 'Provincia' | 'Nacional' | 'Internacional';
  nombre: string;
  fecha: string;
  ejeTematico?: string;
  evidenciaUrl?: string;
}

export interface InsigniaProgress {
  tipo: 'Obsidiana' | 'Jade' | 'Opalo' | 'Diamante';
  otorgada: boolean;
  fechaOtorgada?: string;
}

export interface CreateCaminanteDto {
  nombre: string;
  apellidos: string;
  grupo: string;
  provincia: string;
  comunidad: string;
  equipo?: string;
  cum?: string;
  fechaNacimiento?: string;
  fechaPromesa?: string;
  fechaPaseInicio?: string;
  email?: string;
  password?: string;
}
