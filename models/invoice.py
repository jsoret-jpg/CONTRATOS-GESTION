from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (UniqueConstraint("solped_id", "numero_factura", name="uq_invoice_solped_numero"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    solped_id: Mapped[int] = mapped_column(ForeignKey("solpeds.id", ondelete="CASCADE"), nullable=False, index=True)
    numero_factura: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    fecha_factura: Mapped[date] = mapped_column(Date, nullable=False)
    monto_factura: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moneda: Mapped[str] = mapped_column(String(3), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="registrada")
    fecha_pago: Mapped[date | None] = mapped_column(Date, nullable=True)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
