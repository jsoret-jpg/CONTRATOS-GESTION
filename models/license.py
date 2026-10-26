from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class License(Base):
    __tablename__ = "licenses"
    __table_args__ = (
        UniqueConstraint("company_id", "cuenta", "tipo", name="uq_license_company_cuenta_tipo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    area: Mapped[str | None] = mapped_column(String(100), nullable=True)
    proceso: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    tipo: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    usuario: Mapped[str | None] = mapped_column(String(150), nullable=True)
    cuenta: Mapped[str] = mapped_column(String(150), nullable=False)
    precio: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moneda: Mapped[str] = mapped_column(String(3), nullable=False)
    fecha_renovacion: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
