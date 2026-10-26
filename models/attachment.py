from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tabla_origen: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    registro_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    nombre_archivo: Mapped[str] = mapped_column(String(255), nullable=False)
    ruta_archivo: Mapped[str] = mapped_column(String(500), nullable=False)
    tipo_mime: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tamano: Mapped[int | None] = mapped_column(Integer, nullable=True)
    subido_por: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    fecha_subida: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
