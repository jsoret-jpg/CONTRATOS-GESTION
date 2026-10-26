export interface License {
  id: number;
  company_id: number | null;
  area: string | null;
  proceso: string | null;
  tipo: string;
  usuario: string | null;
  cuenta: string;
  precio: string;
  moneda: string;
  fecha_renovacion: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface LicenseFilters {
  company_id?: number;
  tipo?: string;
  proceso?: string;
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

export interface LicenseSummary {
  total_licencias: number;
  por_tipo: Record<string, number>;
  total_por_moneda: Record<string, number>;
}
