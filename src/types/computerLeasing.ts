export interface ComputerLeasing {
  id: number;
  company_id: number | null;
  area: string | null;
  proceso: string | null;
  usuario: string | null;
  precio: string;
  contrato: string | null;
  provider_id: number | null;
  fecha_asignacion: string;
  fecha_renovacion: string;
  dias_para_renovacion: number;
  renovacion_texto: string;
  renovacion_estado: string;
  equipo: string;
  modelo: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComputerLeasingFilters {
  company_id?: number;
  proceso?: string;
  estado?: string;
  search?: string;
  contrato?: string;
  sin_contrato?: boolean;
}

export interface ImportErrorItem {
  fila: number;
  mensaje: string;
}

export interface ImportSummary {
  insertados: number;
  actualizados: number;
  rechazados: number;
  errores: ImportErrorItem[];
}

export interface ComputerLeasingSummary {
  total: number;
  por_estado: Record<string, number>;
  total_por_empresa: Record<string, string>;
  total_por_proceso: Record<string, string>;
  total_por_contrato: Record<string, string>;
}

export const ESTADOS_RENOVACION = [
  "vigente",
  "proxima_renovacion",
  "renovacion_proxima",
  "renovar_hoy",
  "vencida",
] as const;

export const ESTADO_RENOVACION_LABELS: Record<string, string> = {
  vigente: "Vigente",
  proxima_renovacion: "Próxima renovación",
  renovacion_proxima: "Renovación próxima",
  renovar_hoy: "Renovar hoy",
  vencida: "Vencida",
};

export const ESTADO_RENOVACION_BADGE: Record<string, string> = {
  vigente: "badge-success",
  proxima_renovacion: "",
  renovacion_proxima: "badge-warning",
  renovar_hoy: "badge-warning",
  vencida: "badge-danger",
};

export const SIN_CONTRATO_LABEL = "Sin contrato";
