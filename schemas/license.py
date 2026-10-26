from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator

MONEDAS_VALIDAS = {"PEN", "USD"}


class LicenseBase(BaseModel):
    company_id: int
    area: str | None = None
    proceso: str | None = None
    tipo: str
    usuario: str | None = None
    cuenta: str
    precio: Decimal
    moneda: str
    fecha_renovacion: date | None = None
    observaciones: str | None = None

    @field_validator("moneda")
    @classmethod
    def valida_moneda(cls, v: str) -> str:
        v_norm = v.strip().upper()
        if v_norm not in MONEDAS_VALIDAS:
            raise ValueError(f"Moneda inválida: '{v}'. Debe ser 'PEN' o 'USD'")
        return v_norm


class LicenseCreate(LicenseBase):
    pass


class LicenseUpdate(BaseModel):
    company_id: int | None = None
    area: str | None = None
    proceso: str | None = None
    tipo: str | None = None
    usuario: str | None = None
    cuenta: str | None = None
    precio: Decimal | None = None
    moneda: str | None = None
    fecha_renovacion: date | None = None
    observaciones: str | None = None

    @field_validator("moneda")
    @classmethod
    def valida_moneda(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v_norm = v.strip().upper()
        if v_norm not in MONEDAS_VALIDAS:
            raise ValueError(f"Moneda inválida: '{v}'. Debe ser 'PEN' o 'USD'")
        return v_norm


class LicenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int | None
    area: str | None
    proceso: str | None
    tipo: str
    usuario: str | None
    cuenta: str
    precio: Decimal
    moneda: str
    fecha_renovacion: date | None
    observaciones: str | None
    created_at: datetime
    updated_at: datetime


class ImportErrorItem(BaseModel):
    fila: int
    mensaje: str


class ImportSummary(BaseModel):
    insertados: int
    actualizados: int
    rechazados: int
    errores: list[ImportErrorItem]


class LicenseSummary(BaseModel):
    total_licencias: int
    por_tipo: dict[str, int]
    total_por_moneda: dict[str, Decimal]


class LicenseTypePriceUpdate(BaseModel):
    tipo: str
    precio: Decimal


class LicenseTypePriceUpdateResult(BaseModel):
    tipo: str
    precio: Decimal
    actualizadas: int
