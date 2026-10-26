from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator


class PecuariaCompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class PrinterConsumptionCompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class CostCenterBase(BaseModel):
    name: str
    proceso: str | None = None
    is_active: bool = True


class CostCenterCreate(CostCenterBase):
    pass


class CostCenterUpdate(BaseModel):
    name: str | None = None
    proceso: str | None = None
    is_active: bool | None = None


class CostCenterOut(CostCenterBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pecuaria_company_id: int
    created_at: datetime


class PrinterConsumptionBase(BaseModel):
    cost_center_id: int
    usuario: str
    proceso: str | None = None
    anio: int
    mes: int
    consumo: Decimal

    @field_validator("mes")
    @classmethod
    def valida_mes(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("mes debe estar entre 1 y 12")
        return v


class PrinterConsumptionCreate(PrinterConsumptionBase):
    pass


class PrinterConsumptionUpdate(BaseModel):
    usuario: str | None = None
    proceso: str | None = None
    consumo: Decimal | None = None


class PrinterConsumptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cost_center_id: int
    usuario: str
    proceso: str | None
    anio: int
    mes: int
    consumo: Decimal
    created_at: datetime
    updated_at: datetime


class PrinterInvoiceBase(BaseModel):
    printer_company_id: int
    anio: int
    mes: int
    monto_sin_igv: Decimal
    fecha_factura: date
    observaciones: str | None = None

    @field_validator("mes")
    @classmethod
    def valida_mes(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("mes debe estar entre 1 y 12")
        return v


class PrinterInvoiceCreate(PrinterInvoiceBase):
    pass


class PrinterInvoiceUpdate(BaseModel):
    monto_sin_igv: Decimal | None = None
    fecha_factura: date | None = None
    observaciones: str | None = None


class PrinterInvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    printer_company_id: int
    anio: int
    mes: int
    monto_sin_igv: Decimal
    fecha_factura: date
    observaciones: str | None
    created_at: datetime
    updated_at: datetime


class PrinterAllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    printer_invoice_id: int
    cost_center_id: int
    usuario: str
    proceso: str | None
    anio: int
    mes: int
    consumo: Decimal
    porcentaje_participacion: Decimal
    monto_a_pagar: Decimal
    created_at: datetime


class ImportErrorItem(BaseModel):
    fila: int
    mensaje: str


class ImportSummary(BaseModel):
    insertados: int
    actualizados: int
    rechazados: int
    errores: list[ImportErrorItem]


class AllocationSummary(BaseModel):
    total_monto: Decimal
    por_pecuaria: dict[str, Decimal]
    por_proceso: dict[str, Decimal]
    por_usuario: dict[str, Decimal]
