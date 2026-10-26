from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ServicioProductoCreate(BaseModel):
    nombre: str


class ServicioProductoUpdate(BaseModel):
    nombre: str | None = None
    is_active: bool | None = None


class ServicioProductoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    is_active: bool
    created_at: datetime
