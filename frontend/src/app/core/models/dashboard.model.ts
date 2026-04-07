export interface DashboardStats {
  totalCaminantes: number;
  evidencias: {
    total: number;
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
  };
  insignias: {
    total: number;
    Obsidiana: number;
    Jade: number;
    Opalo: number;
    Diamante: number;
  };
  senderosCompletados: number;
  recentCaminantes: any[];
  recentEvidencias: any[];
}
