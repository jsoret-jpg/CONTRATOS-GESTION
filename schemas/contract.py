from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, computed_field

from services.contract_service import compute_contract_estado, compute_meses_faltantes


class ContractBase(BaseModel):
    company_id: int
    descripcion_servicio: str
    cantidad: int = 1
    numero_contrato: str | None = None
    sede: str | None = None
    fecha_inicio: date
    fecha_fin: date
    tipo_contrato: str
    monto_igv: Decimal
    provider_id: int | None = None
    observaciones: str | None = None


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    company_id: int | None = None
    descripcion_servicio: str | None = None
    cantidad: int | None = None
    numero_contrato: str | None = None
    sede: str | None = None
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    tipo_contrato: str | None = None
    monto_igv: Decimal | None = None
    provider_id: int | None = None
    observaciones: str | None = None


class ContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero_contrato: str
    company_id: int | None
    descripcion_servicio: str
    cantidad: int
    sede: str | None
    fecha_inicio: date
    fecha_fin: date
    tipo_contrato: str
    monto_igv: Decimal
    provider_id: int | None
    observaciones: str | None
    created_at: datetime
    updated_at: datetime
    tiene_archivo: bool = False

    @computed_field
    @property
    def meses_faltantes(self) -> int:
        return compute_meses_faltantes(self.fecha_fin)

    @computed_field
    @property
    def estado(self) -> str:
        return compute_contract_estado(self.fecha_fin, self.tipo_contrato)


class ImportErrorItem(BaseModel):
    fila: int
    mensaje: str


class ImportSummary(BaseModel):
    insertados: int
    actualizados: int
    rechazados: int
    errores: list[ImportErrorItem]


class ContractSummary(BaseModel):
    total_contratos: int
    por_estado: dict[str, int]
