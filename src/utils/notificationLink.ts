import type { Notification } from "../types/notification";

export function resolveNotificationLink(notification: Notification): string {
  const codigo = notification.referencia_codigo ?? "";

  switch (notification.modulo) {
    case "contrato":
      return `/contratos?search=${encodeURIComponent(codigo)}`;
    case "factura":
      return "/facturas?estado=registrada";
    case "solped":
      return `/solpeds?search=${encodeURIComponent(codigo)}`;
    case "pago_mensual":
      return `/pagos-mensuales?tipo_servicio=${encodeURIComponent(codigo)}`;
    case "presupuesto":
      return `/presupuesto?servicio_producto_id=${encodeURIComponent(codigo)}`;
    default:
      return "/alertas";
  }
}
