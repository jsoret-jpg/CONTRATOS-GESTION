from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator


class BudgetBase(BaseModel):
    company_id: int
    servicio_producto_id: int
    anio: int
    mes: int
    monto_mensual: Decimal
    monto_anual: Decimal | None = None

    @field_validator("mes")
    @classmethod
    def valida_mes(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("mes debe estar entre 1 y 12")
        return v


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    monto_mensual: Decimal | None = None
    monto_anual: Decimal | None = None


class BudgetOut(BaseModel):
    id: int
    company_id: int
    servicio_producto_id: int
    servicio_producto_nombre: str
    anio: int
    mes: int
    monto_mensual: Decimal
    monto_anual: Decimal | None
    ejecutado: Decimal
    compensado: Decimal
    presupuesto_asignado: Decimal
    disponible: Decimal
    porcentaje_ejecutado: Decimal
    excedido: bool
    created_at: datetime
    updated_at: datetime


class CompensationCreate(BaseModel):
    monto: Decimal
    fecha: date
    origen: str | None = None
    anio_origen: int | None = None
    mes_origen: int | None = None
    motivo: str | None = None


class BudgetMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    budget_id: int
    tipo: str
    solped_id: int | None
    monto: Decimal
    fecha: date
    usuario_id: int | None
    origen: str | None
    anio_origen: int | None
    mes_origen: int | None
    motivo: str | None
    created_at: datetime


class BudgetSummary(BaseModel):
    total_asignado: Decimal
    total_ejecutado: Decimal
    total_disponible: Decimal
    presupuestos_excedidos: int


# --- Vista anual: un presupuesto (año + empresa + servicio/producto) con
# los 12 meses editables en una sola pantalla, tal como se pidió. ---


class MonthlyBudgetDetail(BaseModel):
    mes: int
    budget_id: int | None
    monto_mensual: Decimal
    ejecutado: Decimal
    disponible: Decimal
    porcentaje_ejecutado: Decimal
    excedido: bool


class AnnualBudgetOut(BaseModel):
    company_id: int
    servicio_producto_id: int
    servicio_producto_nombre: str
    anio: int
    meses: list[MonthlyBudgetDetail]
    total_anual: Decimal
    total_ejecutado: Decimal
    total_disponible: Decimal
    porcentaje_ejecucion_anual: Decimal


class AnnualBudgetUpsert(BaseModel):
    company_id: int
    servicio_producto_id: int
    anio: int
    # Mapa mes (1-12, como texto) -> monto. Los meses que no vengan no se
    # tocan; para dejar un mes en blanco, envíalo con monto 0.
    montos: dict[str, Decimal]

    @field_validator("montos")
    @classmethod
    def valida_meses(cls, v: dict[str, Decimal]) -> dict[str, Decimal]:
        for mes_str in v:
            try:
                mes = int(mes_str)
            except ValueError as exc:
                raise ValueError(f"mes inválido: '{mes_str}'") from exc
            if not 1 <= mes <= 12:
                raise ValueError(f"mes fuera de rango: {mes_str} (debe estar entre 1 y 12)")
        return v
