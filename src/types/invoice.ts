export interface Invoice {
  id: number;
  solped_id: number;
  numero_factura: string;
  fecha_factura: string;
  monto_factura: string;
  moneda: string;
  estado: string;
  fecha_pago: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}
