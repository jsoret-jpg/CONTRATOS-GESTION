from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: str
    modulo: str
    referencia_tabla: str
    referencia_id: int
    referencia_codigo: str | None
    mensaje: str
    leida: bool
    created_at: datetime


class NotificationSummary(BaseModel):
    total: int
    no_leidas: int
    por_tipo: dict[str, int]


class NotificationRecipientCreate(BaseModel):
    email: EmailStr


class NotificationRecipientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    activo: bool
    created_at: datetime


class SendEmailResult(BaseModel):
    enviado: bool
    mensaje: str
