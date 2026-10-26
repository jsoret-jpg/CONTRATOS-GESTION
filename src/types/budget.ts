export interface Budget {
  id: number;
  company_id: number;
  servicio_producto_id: number;
  servicio_producto_nombre: string;
  anio: number;
  mes: number;
  monto_mensual: string;
  monto_anual: string | null;
  ejecutado: string;
  compensado: string;
  presupuesto_asignado: string;
  disponible: string;
  porcentaje_ejecutado: string;
  excedido: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetMovement {
  id: number;
  budget_id: number;
  tipo: string;
  solped_id: number | null;
  monto: string;
  fecha: string;
  usuario_id: number | null;
  origen: string | null;
  anio_origen: number | null;
  mes_origen: number | null;
  motivo: string | null;
  created_at: string;
}

export interface BudgetSummary {
  total_asignado: string;
  total_ejecutado: string;
  total_disponible: string;
  presupuestos_excedidos: number;
}

export interface BudgetFilters {
  company_id?: number;
  servicio_producto_id?: number;
  anio?: number;
  mes?: number;
}

export interface MonthlyBudgetDetail {
  mes: number;
  budget_id: number | null;
  monto_mensual: string;
  ejecutado: string;
  disponible: string;
  porcentaje_ejecutado: string;
  excedido: boolean;
}

export interface AnnualBudget {
  company_id: number;
  servicio_producto_id: number;
  servicio_producto_nombre: string;
  anio: number;
  meses: MonthlyBudgetDetail[];
  total_anual: string;
  total_ejecutado: string;
  total_disponible: string;
  porcentaje_ejecucion_anual: string;
}

export interface ServicioProducto {
  id: number;
  nombre: string;
  is_active: boolean;
  created_at: string;
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
