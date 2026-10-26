from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, computed_field

from utils.renovacion_calculator import (
    compute_dias_para_renovacion,
    compute_renovacion_estado,
    compute_renovacion_texto,
)


class ComputerLeasingBase(BaseModel):
    company_id: int
    area: str | None = None
    proceso: str | None = None
    usuario: str | None = None
    precio: Decimal
    contrato: str | None = None
    provider_id: int | None = None
    fecha_asignacion: date
    fecha_renovacion: date
    equipo: str
    modelo: str | None = None
    observaciones: str | None = None


class ComputerLeasingCreate(ComputerLeasingBase):
    pass


class ComputerLeasingUpdate(BaseModel):
    company_id: int | None = None
    area: str | None = None
    proceso: str | None = None
    usuario: str | None = None
    precio: Decimal | None = None
    contrato: str | None = None
    provider_id: int | None = None
    fecha_asignacion: date | None = None
    fecha_renovacion: date | None = None
    equipo: str | None = None
    modelo: str | None = None
    observaciones: str | None = None


class ComputerLeasingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int | None
    area: str | None
    proceso: str | None
    usuario: str | None
    precio: Decimal
    contrato: str | None
    provider_id: int | None
    fecha_asignacion: date
    fecha_renovacion: date
    equipo: str
    modelo: str | None
    observaciones: str | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def dias_para_renovacion(self) -> int:
        return compute_dias_para_renovacion(self.fecha_renovacion)

    @computed_field
    @property
    def renovacion_texto(self) -> str:
        return compute_renovacion_texto(compute_dias_para_renovacion(self.fecha_renovacion))

    @computed_field
    @property
    def renovacion_estado(self) -> str:
        return compute_renovacion_estado(compute_dias_para_renovacion(self.fecha_renovacion))


class ImportErrorItem(BaseModel):
    fila: int
    mensaje: str


class ImportSummary(BaseModel):
    insertados: int
    actualizados: int
    rechazados: int
    errores: list[ImportErrorItem]


class ComputerLeasingSummary(BaseModel):
    total: int
    por_estado: dict[str, int]
    total_por_empresa: dict[str, Decimal]
    total_por_proceso: dict[str, Decimal]
    total_por_contrato: dict[str, Decimal]
