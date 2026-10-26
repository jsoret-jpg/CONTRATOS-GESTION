export interface PecuariaCompany {
  id: number;
  name: string;
}

export interface PrinterConsumptionCompany {
  id: number;
  name: string;
}

export interface CostCenter {
  id: number;
  name: string;
  pecuaria_company_id: number;
  proceso: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PrinterConsumption {
  id: number;
  cost_center_id: number;
  usuario: string;
  proceso: string | null;
  anio: number;
  mes: number;
  consumo: string;
  created_at: string;
  updated_at: string;
}

export interface PrinterInvoice {
  id: number;
  printer_company_id: number;
  anio: number;
  mes: number;
  monto_sin_igv: string;
  fecha_factura: string;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrinterAllocation {
  id: number;
  printer_invoice_id: number;
  cost_center_id: number;
  usuario: string;
  proceso: string | null;
  anio: number;
  mes: number;
  consumo: string;
  porcentaje_participacion: string;
  monto_a_pagar: string;
  created_at: string;
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

export interface AllocationSummary {
  total_monto: string;
  por_pecuaria: Record<string, string>;
  por_proceso: Record<string, string>;
  por_usuario: Record<string, string>;
}

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
