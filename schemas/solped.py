from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

TIPOS_VALIDOS = {"producto", "servicio"}
MONEDAS_VALIDAS = {"PEN", "USD"}
ESTADOS_VALIDOS = {
    "aprobado_nivel_1",
    "aprobado_nivel_2",
    "aprobado_nivel_3",
    "aprobado_nivel_4",
    "orden_registrada",
    "orden_enviada",
    "factura_registrada",
    "factura_pagada",
}


class SolpedBase(BaseModel):
    numero_solped: str
    company_id: int
    tipo: str
    descripcion: str | None = None
    servicio_producto_id: int | None = None
    fecha_solped: date
    provider_id: int | None = None
    numero_orden: str | None = None
    monto_orden: Decimal = Decimal("0")
    moneda: str
    estado: str
    presupuestada: bool = False
    monto_presupuesto: Decimal | None = None
    monto_ejecutado: Decimal | None = None
    fecha_ejecucion: date | None = None
    contract_id: int | None = None
    observaciones: str | None = None

    @field_validator("tipo")
    @classmethod
    def valida_tipo(cls, v: str) -> str:
        v_norm = v.strip().lower()
        if v_norm not in TIPOS_VALIDOS:
            raise ValueError(f"Tipo inválido: '{v}'. Debe ser 'producto' o 'servicio'")
        return v_norm

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
        if v_norm not in ESTADOS_VALIDOS:
            raise ValueError(f"Estado inválido: '{v}'")
        return v_norm


class SolpedCreate(SolpedBase):
    pass


class SolpedUpdate(BaseModel):
    company_id: int | None = None
    tipo: str | None = None
    descripcion: str | None = None
    servicio_producto_id: int | None = None
    fecha_solped: date | None = None
    provider_id: int | None = None
    numero_orden: str | None = None
    monto_orden: Decimal | None = None
    moneda: str | None = None
    estado: str | None = None
    presupuestada: bool | None = None
    monto_presupuesto: Decimal | None = None
    monto_ejecutado: Decimal | None = None
    fecha_ejecucion: date | None = None
    contract_id: int | None = None
    observaciones: str | None = None

    @field_validator("tipo")
    @classmethod
    def valida_tipo(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v_norm = v.strip().lower()
        if v_norm not in TIPOS_VALIDOS:
            raise ValueError(f"Tipo inválido: '{v}'. Debe ser 'producto' o 'servicio'")
        return v_norm

    @field_validator("moneda")
    @classmethod
    def valida_moneda(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v_norm = v.strip().upper()
        if v_norm not in MONEDAS_VALIDAS:
            raise ValueError(f"Moneda inválida: '{v}'. Debe ser 'PEN' o 'USD'")
        return v_norm

    @field_validator("estado")
    @classmethod
    def valida_estado(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v_norm = v.strip().lower()
        if v_norm not in ESTADOS_VALIDOS:
            raise ValueError(f"Estado inválido: '{v}'")
        return v_norm


class SolpedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero_solped: str
    company_id: int | None
    tipo: str
    descripcion: str | None
    servicio_producto_id: int | None
    servicio_producto_nombre: str | None = None
    fecha_solped: date
    provider_id: int | None
    numero_orden: str | None
    monto_orden: Decimal
    moneda: str
    estado: str
    presupuestada: bool
    monto_presupuesto: Decimal | None
    monto_ejecutado: Decimal | None
    fecha_ejecucion: date | None
    contract_id: int | None
    contract_numero: str | None = None
    observaciones: str | None
    created_at: datetime
    updated_at: datetime
    presupuesto_alerta: str | None = None

    @computed_field
    @property
    def saldo(self) -> Decimal | None:
        if self.monto_presupuesto is not None and self.monto_ejecutado is not None:
            return self.monto_presupuesto - self.monto_ejecutado
        return None


class ImportErrorItem(BaseModel):
    fila: int
    mensaje: str


class ImportSummary(BaseModel):
    insertados: int
    actualizados: int
    rechazados: int
    errores: list[ImportErrorItem]


class SolpedSummary(BaseModel):
    total_solpeds: int
    por_estado: dict[str, int]
    total_por_moneda: dict[str, Decimal]
