export interface AltaBaja {
  id?: number;
  tipo: 'alta' | 'baja';
  cum?: string;
  nombre: string;
  orden: number;
}

export interface AsistenciaActividad {
  id?: number;
  fecha?: string;
  actividad: string;
  asistencia: number;
  asistentes?: string[];
  observaciones?: string;
  orden: number;
}

export interface ActividadPendiente {
  id?: number;
  actividad: string;
  observaciones?: string;
  orden: number;
}

export interface MovimientoFinanciero {
  id?: number;
  tipo: 'ingreso' | 'egreso';
  fecha?: string;
  concepto: string;
  cantidad: number;
  orden: number;
}

export interface InventarioItem {
  id?: number;
  seccion: string;
  anioCompra?: number;
  marca?: string;
  descripcion: string;
  cantidad: number;
  observaciones?: string;
}

export interface ProgresionInforme {
  id?: number;
  descripcion: string;
  nombre: string;
  actividadNombre?: string;
  fecha?: string;
  orden: number;
}

export interface InformeMensual {
  id: number;
  mes: number;
  anio: number;
  seccion: string;
  totalRegistrados: number;
  totalEnlace: number;
  totalCaptacion: number;
  totalNoRegistrados: number;
  saldoInicial: number;
  observacionesGenerales?: string;
  creadoPorId: number;
  creadoPor?: { id: number; nombre: string };
  altasBajas: AltaBaja[];
  actividades: AsistenciaActividad[];
  actividadesPendientes: ActividadPendiente[];
  movimientos: MovimientoFinanciero[];
  progresiones: ProgresionInforme[];
  createdAt: string;
}

export interface CrearInformeDto {
  mes: number;
  anio: number;
  seccion: string;
  totalRegistrados: number;
  totalEnlace: number;
  totalCaptacion: number;
  totalNoRegistrados: number;
  saldoInicial: number;
  observacionesGenerales?: string;
  altasBajas: AltaBaja[];
  actividades: AsistenciaActividad[];
  actividadesPendientes: ActividadPendiente[];
  movimientos: MovimientoFinanciero[];
  progresiones: ProgresionInforme[];
}

export const MESES_NOMBRES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
