export interface MonthlyExecution {
  mes: number;
  ejecutado: string;
}

export interface DashboardSummary {
  solpeds_total: number;
  solpeds_pendientes: number;
  solpeds_por_estado: Record<string, number>;
  contratos_total: number;
  contratos_por_vencer: number;
  contratos_vencidos: number;
  facturas_total: number;
  facturas_pendientes: number;
  facturas_por_estado: Record<string, number>;
  gastos_mensuales_pendientes: number;
  presupuesto_ejecutado: string;
  presupuesto_disponible: string;
  presupuesto_excedido_count: number;
  gastos_por_empresa: Record<string, string>;
  gastos_por_proveedor: Record<string, string>;
  ejecucion_presupuestal_mensual: MonthlyExecution[];
}

export interface GlobalInvoice {
  id: number;
  solped_id: number;
  numero_solped: string;
  company_id: number;
  numero_factura: string;
  fecha_factura: string;
  monto_factura: string;
  moneda: string;
  estado: string;
  fecha_pago: string | null;
}
