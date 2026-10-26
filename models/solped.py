from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Solped(Base):
    __tablename__ = "solpeds"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero_solped: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    servicio_producto_id: Mapped[int | None] = mapped_column(
        ForeignKey("servicios_productos.id"), nullable=True, index=True
    )
    contract_id: Mapped[int | None] = mapped_column(ForeignKey("contracts.id"), nullable=True, index=True)
    fecha_solped: Mapped[date] = mapped_column(Date, nullable=False)
    provider_id: Mapped[int | None] = mapped_column(ForeignKey("providers.id"), nullable=True, index=True)
    numero_orden: Mapped[str | None] = mapped_column(String(50), nullable=True)
    monto_orden: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    moneda: Mapped[str] = mapped_column(String(3), nullable=False)
    estado: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    presupuestada: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    monto_presupuesto: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    monto_ejecutado: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    fecha_ejecucion: Mapped[date | None] = mapped_column(Date, nullable=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
