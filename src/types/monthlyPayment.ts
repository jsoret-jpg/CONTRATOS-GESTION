export interface MonthlyPayment {
  id: number;
  company_id: number | null;
  tipo_servicio: string;
  anio: number;
  mes: number;
  monto: string;
  solped_registrada: boolean;
  factura_registrada: boolean;
  pagada: boolean;
  porcentaje: number;
  estado: string;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyPaymentFilters {
  company_id?: number;
  anio?: number;
  mes?: number;
  tipo_servicio?: string;
  pagada?: boolean;
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

export interface MonthlyPaymentSummary {
  total: number;
  por_estado: Record<string, number>;
  total_monto_pagado: string;
  total_monto_pendiente: string;
}

export const ESTADO_PAGO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  listo_para_pago: "Listo para pagar",
  pagado: "Pagado",
};

export const ESTADO_PAGO_BADGE: Record<string, string> = {
  pendiente: "",
  en_proceso: "badge-warning",
  listo_para_pago: "badge-warning",
  pagado: "badge-success",
};

export const MESES_LABELS = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
