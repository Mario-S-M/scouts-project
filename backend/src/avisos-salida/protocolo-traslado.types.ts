/**
 * Datos del "Protocolo de seguridad en el traslado" de CNAR que no salen del
 * aviso. Viven en aviso.data.protocolo. Lo que sí sale del aviso (evento, lugar,
 * fechas de salida/regreso, pasajeros y conteos) no se repite aquí.
 */
export type MedioTransporte = 'contratado' | 'particular' | 'autobus' | 'aereo';

export interface ProtocoloTraslado {
  /** Coordinador de seguridad: se queda en la ciudad, NO asiste */
  coordinador?: { nombre?: string; cargo?: string; telLocal?: string; celular?: string };
  /** Enlace de seguridad: viaja con el grupo */
  enlace?: { nombre?: string; cargo?: string; celular1?: string; celular2?: string };
  /** Llegada estimada al lugar del evento */
  llegadaDestino?: { fecha?: string; hora?: string };
  /** Llegada estimada de vuelta a la ciudad */
  llegadaOrigen?: { fecha?: string; hora?: string };
  transporte?: MedioTransporte;
  contratado?: {
    empresa?: string; telefonos?: string; marcaModelo?: string; placas?: string; operador?: string;
    documentos?: { contrato?: boolean; feMecanica?: boolean; seguroViajero?: boolean; licencia?: boolean; tarjetaCirculacion?: boolean };
  };
  particular?: {
    marca?: string; modelo?: string; anio?: string; capacidad?: string; placas?: string; color?: string;
    conductor?: string; licencia?: string; expedidaPor?: string;
    documentos?: { poliza?: boolean; licencia?: boolean; tarjetaCirculacion?: boolean };
  };
  autobus?: {
    lineaSalida?: string; lineaRegreso?: string;
    salidaFecha?: string; salidaHora?: string; regresoFecha?: string; regresoHora?: string;
    /** Cómo van de la terminal de destino al lugar del evento */
    trasladoTerminal?: string;
  };
  aereo?: {
    salida?: { aerolinea?: string; aeropuerto?: string; vuelo?: string; fecha?: string; hora?: string };
    regreso?: { aerolinea?: string; aeropuerto?: string; vuelo?: string; fecha?: string; hora?: string };
    trasladoDestino?: string;
    trasladoOrigen?: string;
  };
}

/**
 * Valores por defecto del grupo. Se ofrecen al crear un aviso (formulario y MCP);
 * siempre se pueden cambiar en cada salida.
 */
export const PROTOCOLO_DEFAULTS: ProtocoloTraslado & { provincia: string; grupo: string } = {
  provincia: 'Michoacán',
  grupo: '7 Morelia',
  coordinador: { nombre: 'María Elena Padilla Hernández', cargo: 'Jefa de Grupo', telLocal: '', celular: '443 242 1325' },
  enlace: { nombre: 'Mario Eduardo Sánchez Mejía', cargo: 'Jefe de Comunidad', celular1: '443 840 9187', celular2: '' },
  transporte: 'autobus',
};
