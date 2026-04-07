export type TipoEvidencia =
  | 'sendero'
  | 'especialidad'
  | 'aventura'
  | 'iniciativa'
  | 'evento'
  | 'puntaDeFlecha';

export type EtapaEvidencia =
  | 'conozco'
  | 'aplico'
  | 'comparto'
  | 'participacion'
  | 'certificacion';

export type EstadoEvidencia = 'pendiente' | 'aprobada' | 'rechazada';

export interface Evidencia {
  id: number;
  caminanteId: number;
  caminante?: {
    id: number;
    nombre: string;
    apellidos: string;
  };
  tipo: TipoEvidencia;
  categoria: string;
  subcategoria?: string;
  etapa?: EtapaEvidencia;
  descripcion?: string;
  archivoUrl?: string;
  estado: EstadoEvidencia;
  comentarioValidador?: string;
  validadoPor?: string;
  fechaSubida: string;
  fechaValidacion?: string;
}

export interface CreateEvidenciaDto {
  caminanteId: number;
  tipo: TipoEvidencia;
  categoria: string;
  subcategoria?: string;
  etapa?: EtapaEvidencia;
  descripcion?: string;
}

export interface ValidarEvidenciaDto {
  estado: 'aprobada' | 'rechazada';
  comentarioValidador?: string;
  validadoPor?: string;
}
