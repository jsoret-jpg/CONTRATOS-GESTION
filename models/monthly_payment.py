from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MonthlyPayment(Base):
    __tablename__ = "monthly_payments"
    __table_args__ = (
        UniqueConstraint("company_id", "tipo_servicio", "anio", "mes", name="uq_monthly_payment_periodo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    tipo_servicio: Mapped[str] = mapped_column(String(100), nullable=False)
    anio: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    mes: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    # Checklist: exactamente 3 pasos, cada uno vale 33.33% del avance.
    # "pagada" es el tercer paso del checklist (Factura pagada), no una
    # bandera separada: solo puede ser True si los 2 pasos anteriores lo son.
    solped_registrada: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    factura_registrada: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pagada: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    observaciones: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
