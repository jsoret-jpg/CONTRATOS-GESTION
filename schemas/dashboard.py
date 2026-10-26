from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class MonthlyExecution(BaseModel):
    mes: int
    ejecutado: Decimal


class DashboardSummary(BaseModel):
    solpeds_total: int
    solpeds_pendientes: int
    solpeds_por_estado: dict[str, int]
    contratos_total: int
    contratos_por_vencer: int
    contratos_vencidos: int
    facturas_total: int
    facturas_pendientes: int
    facturas_por_estado: dict[str, int]
    gastos_mensuales_pendientes: int
    presupuesto_ejecutado: Decimal
    presupuesto_disponible: Decimal
    presupuesto_excedido_count: int
    gastos_por_empresa: dict[str, Decimal]
    gastos_por_proveedor: dict[str, Decimal]
    ejecucion_presupuestal_mensual: list[MonthlyExecution]


class GlobalInvoiceOut(BaseModel):
    id: int
    solped_id: int
    numero_solped: str
    company_id: int | None
    numero_factura: str
    fecha_factura: date
    monto_factura: Decimal
    moneda: str
    estado: str
    fecha_pago: date | None
