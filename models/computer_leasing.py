from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class ComputerLeasing(Base):
    __tablename__ = "computer_leasing"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    area: Mapped[str | None] = mapped_column(String(100), nullable=True)
    proceso: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    usuario: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    precio: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    contrato: Mapped[str | None] = mapped_column(String(100), nullable=True)
    provider_id: Mapped[int | None] = mapped_column(ForeignKey("providers.id"), nullable=True, index=True)
    fecha_asignacion: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_renovacion: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    equipo: Mapped[str] = mapped_column(String(100), nullable=False)
    modelo: Mapped[str | None] = mapped_column(String(150), nullable=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
