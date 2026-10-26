from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PrinterConsumptionCompany(Base):
    """'Empresas de consumo': quien recibe y paga la factura de impresoras
    (Oregon Foods, Valora). Catálogo independiente del catálogo principal de
    empresas, aunque comparta nombres con él."""

    __tablename__ = "printer_consumption_companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)


class PecuariaCompany(Base):
    """'Empresas pecuarias': las unidades de negocio cuyo consumo real de
    impresión se prorratea (Oregon, Protein, MP)."""

    __tablename__ = "pecuaria_companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)


class CostCenter(Base):
    __tablename__ = "cost_centers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    pecuaria_company_id: Mapped[int] = mapped_column(
        ForeignKey("pecuaria_companies.id"), nullable=False, index=True
    )
    proceso: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PrinterConsumption(Base):
    __tablename__ = "printer_consumption"
    __table_args__ = (
        UniqueConstraint("cost_center_id", "usuario", "anio", "mes", name="uq_printer_consumption_periodo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    cost_center_id: Mapped[int] = mapped_column(ForeignKey("cost_centers.id"), nullable=False, index=True)
    usuario: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    proceso: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    anio: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    mes: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    consumo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PrinterInvoice(Base):
    __tablename__ = "printer_invoices"
    __table_args__ = (
        UniqueConstraint("printer_company_id", "anio", "mes", name="uq_printer_invoice_periodo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    printer_company_id: Mapped[int] = mapped_column(
        ForeignKey("printer_consumption_companies.id"), nullable=False, index=True
    )
    anio: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    mes: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    monto_sin_igv: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    fecha_factura: Mapped[date] = mapped_column(Date, nullable=False)
    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PrinterAllocation(Base):
    """Resultado del prorrateo, guardado por periodo para consulta histórica."""

    __tablename__ = "printer_allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    printer_invoice_id: Mapped[int] = mapped_column(
        ForeignKey("printer_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cost_center_id: Mapped[int] = mapped_column(ForeignKey("cost_centers.id"), nullable=False, index=True)
    usuario: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    proceso: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    anio: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    mes: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    consumo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    porcentaje_participacion: Mapped[Decimal] = mapped_column(Numeric(9, 4), nullable=False)
    monto_a_pagar: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
