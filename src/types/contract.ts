export interface Contract {
  id: number;
  numero_contrato: string;
  company_id: number | null;
  descripcion_servicio: string;
  cantidad: number;
  sede: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  meses_faltantes: number;
  estado: string;
  tipo_contrato: string;
  monto_igv: string;
  provider_id: number | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  tiene_archivo: boolean;
}

export interface ContractFilters {
  company_id?: number;
  tipo_contrato?: string;
  estado?: string;
  search?: string;
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

export interface ContractSummary {
  total_contratos: number;
  por_estado: Record<string, number>;
}

export const ESTADOS_CONTRATO = ["vigente", "proximo_vencer", "urgente", "vencido"] as const;

export const ESTADO_CONTRATO_LABELS: Record<string, string> = {
  vigente: "Vigente",
  proximo_vencer: "Próximo a vencer",
  urgente: "Urgente",
  vencido: "Vencido",
};

export const ESTADO_CONTRATO_BADGE: Record<string, string> = {
  vigente: "badge-success",
  proximo_vencer: "",
  urgente: "badge-warning",
  vencido: "badge-danger",
};
