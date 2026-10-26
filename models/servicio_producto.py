from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ServicioProducto(Base):
    """Catálogo de servicios/productos presupuestables. Presupuesto y SOLPED
    se relacionan con este catálogo mediante su ID, nunca por el nombre
    escrito, para evitar errores por variaciones de texto."""

    __tablename__ = "servicios_productos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
