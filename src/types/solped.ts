export interface Solped {
  id: number;
  numero_solped: string;
  company_id: number | null;
  tipo: string;
  descripcion: string | null;
  servicio_producto_id: number | null;
  servicio_producto_nombre: string | null;
  contract_id: number | null;
  contract_numero: string | null;
  fecha_solped: string;
  provider_id: number | null;
  numero_orden: string | null;
  monto_orden: string;
  moneda: string;
  estado: string;
  presupuestada: boolean;
  monto_presupuesto: string | null;
  monto_ejecutado: string | null;
  saldo: string | null;
  fecha_ejecucion: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  presupuesto_alerta: string | null;
}

export interface SolpedFilters {
  estado?: string;
  company_id?: number;
  tipo?: string;
  moneda?: string;
  provider_id?: number;
  search?: string;
  excluir_estado?: string;
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

export interface SolpedSummary {
  total_solpeds: number;
  por_estado: Record<string, number>;
  total_por_moneda: Record<string, number>;
}

export const ESTADOS_SOLPED = [
  "aprobado_nivel_1",
  "aprobado_nivel_2",
  "aprobado_nivel_3",
  "aprobado_nivel_4",
  "orden_registrada",
  "orden_enviada",
  "factura_registrada",
  "factura_pagada",
] as const;

export const ESTADO_LABELS: Record<string, string> = {
  aprobado_nivel_1: "Aprobado nivel 1",
  aprobado_nivel_2: "Aprobado nivel 2",
  aprobado_nivel_3: "Aprobado nivel 3",
  aprobado_nivel_4: "Aprobado nivel 4",
  orden_registrada: "Orden registrada",
  orden_enviada: "Orden enviada",
  factura_registrada: "Factura registrada",
  factura_pagada: "Factura pagada",
};
