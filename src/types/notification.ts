export interface Notification {
  id: number;
  tipo: string;
  modulo: string;
  referencia_tabla: string;
  referencia_id: number;
  referencia_codigo: string | null;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

export interface NotificationSummary {
  total: number;
  no_leidas: number;
  por_tipo: Record<string, number>;
}

export interface NotificationRecipient {
  id: number;
  email: string;
  activo: boolean;
  created_at: string;
}

export const TIPO_LABELS: Record<string, string> = {
  contrato_por_vencer: "Contrato por vencer",
  contrato_vencido: "Contrato vencido",
  factura_pendiente: "Factura pendiente",
  solped_pendiente: "SOLPED pendiente",
  orden_no_enviada: "Orden no enviada",
  pago_mensual_pendiente: "Pago mensual pendiente",
  presupuesto_por_agotarse: "Presupuesto por agotarse",
  presupuesto_excedido: "Presupuesto excedido",
  gasto_pendiente: "Gasto pendiente",
};
