from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator

MONEDAS_VALIDAS = {"PEN", "USD"}
ESTADOS_FACTURA = {"registrada", "pagada"}


class InvoiceBase(BaseModel):
    numero_factura: str
    fecha_factura: date
    monto_factura: Decimal
    moneda: str
    estado: str = "registrada"
    fecha_pago: date | None = None
    observaciones: str | None = None

    @field_validator("moneda")
    @classmethod
    def valida_moneda(cls, v: str) -> str:
        v_norm = v.strip().upper()
        if v_norm not in MONEDAS_VALIDAS:
            raise ValueError(f"Moneda inválida: '{v}'. Debe ser 'PEN' o 'USD'")
        return v_norm

    @field_validator("estado")
    @classmethod
    def valida_estado(cls, v: str) -> str:
        v_norm = v.strip().lower()
        if v_norm not in ESTADOS_FACTURA:
            raise ValueError(f"Estado inválido: '{v}'. Debe ser 'registrada' o 'pagada'")
        return v_norm


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    numero_factura: str | None = None
    fecha_factura: date | None = None
    monto_factura: Decimal | None = None
    moneda: str | None = None
    estado: str | None = None
    fecha_pago: date | None = None
    observaciones: str | None = None

    @field_validator("moneda")
    @classmethod
    def valida_moneda(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v_norm = v.strip().upper()
        if v_norm not in MONEDAS_VALIDAS:
            raise ValueError(f"Moneda inválida: '{v}'")
        return v_norm

    @field_validator("estado")
    @classmethod
    def valida_estado(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v_norm = v.strip().lower()
        if v_norm not in ESTADOS_FACTURA:
            raise ValueError(f"Estado inválido: '{v}'. Debe ser 'registrada' o 'pagada'")
        return v_norm


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    solped_id: int
    numero_factura: str
    fecha_factura: date
    monto_factura: Decimal
    moneda: str
    estado: str
    fecha_pago: date | None
    observaciones: str | None
    created_at: datetime
    updated_at: datetime
    presupuesto_alerta: str | None = None
