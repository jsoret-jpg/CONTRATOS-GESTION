from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("company_id", "servicio_producto_id", "anio", "mes", name="uq_budget_periodo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    servicio_producto_id: Mapped[int] = mapped_column(
        ForeignKey("servicios_productos.id"), nullable=False, index=True
    )
    anio: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    mes: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    monto_mensual: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    monto_anual: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class BudgetMovement(Base):
    """tipo='ejecucion': generado automáticamente cuando una SOLPED registra
    un monto ejecutado contra este presupuesto (solped_id apunta a ella).
    tipo='compensacion': registrado manualmente para trasladar presupuesto
    desde otro origen/periodo."""

    __tablename__ = "budget_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    solped_id: Mapped[int | None] = mapped_column(
        ForeignKey("solpeds.id", ondelete="CASCADE"), nullable=True, index=True
    )
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    origen: Mapped[str | None] = mapped_column(String(200), nullable=True)
    anio_origen: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mes_origen: Mapped[int | None] = mapped_column(Integer, nullable=True)
    motivo: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
