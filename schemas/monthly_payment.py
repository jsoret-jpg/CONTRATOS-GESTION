from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

from services.monthly_payment_service import compute_estado, compute_porcentaje


class MonthlyPaymentBase(BaseModel):
    company_id: int
    tipo_servicio: str
    anio: int
    mes: int
    monto: Decimal
    solped_registrada: bool = False
    factura_registrada: bool = False
    pagada: bool = False
    observaciones: str | None = None

    @field_validator("mes")
    @classmethod
    def valida_mes(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("mes debe estar entre 1 y 12")
        return v

    @field_validator("anio")
    @classmethod
    def valida_anio(cls, v: int) -> int:
        if v < 2000 or v > 2100:
            raise ValueError("anio fuera de rango válido")
        return v


class MonthlyPaymentCreate(MonthlyPaymentBase):
    pass


class MonthlyPaymentUpdate(BaseModel):
    company_id: int | None = None
    tipo_servicio: str | None = None
    anio: int | None = None
    mes: int | None = None
    monto: Decimal | None = None
    solped_registrada: bool | None = None
    factura_registrada: bool | None = None
    pagada: bool | None = None
    observaciones: str | None = None


class MonthlyPaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int | None
    tipo_servicio: str
    anio: int
    mes: int
    monto: Decimal
    solped_registrada: bool
    factura_registrada: bool
    pagada: bool
    observaciones: str | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def porcentaje(self) -> int:
        return compute_porcentaje(self)

    @computed_field
    @property
    def estado(self) -> str:
        return compute_estado(self)


class ImportErrorItem(BaseModel):
    fila: int
    mensaje: str


class ImportSummary(BaseModel):
    insertados: int
    actualizados: int
    rechazados: int
    errores: list[ImportErrorItem]


class MonthlyPaymentSummary(BaseModel):
    total: int
    por_estado: dict[str, int]
    total_monto_pagado: Decimal
    total_monto_pendiente: Decimal
