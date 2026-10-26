from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.monthly_payment import MonthlyPayment

# Checklist de 3 pasos según el requerimiento: SOLPED registrada, Factura
# registrada y Factura pagada. Los campos "solped_subida" y "paso_a_registro"
# ya no forman parte del checklist activo (se mantienen en la base de datos
# sin usarse, para no perder información ya registrada en instalaciones
# existentes).
PRE_PAGO_FIELDS = ["solped_registrada", "factura_registrada"]
CHECKLIST_FIELDS = ["solped_registrada", "factura_registrada", "pagada"]


def compute_porcentaje(payment) -> int:
    completados = sum(1 for field in CHECKLIST_FIELDS if getattr(payment, field))
    return round(completados / len(CHECKLIST_FIELDS) * 100)


def compute_estado(payment) -> str:
    if payment.pagada:
        return "pagado"
    if all(getattr(payment, field) for field in PRE_PAGO_FIELDS):
        return "listo_para_pago"
    if any(getattr(payment, field) for field in PRE_PAGO_FIELDS):
        return "en_proceso"
    return "pendiente"


def checklist_completo(payment) -> bool:
    """Antes de poder marcar 'pagada' (el tercer paso del checklist), deben
    estar completos los dos pasos previos: SOLPED registrada y Factura
    registrada."""
    return all(getattr(payment, field) for field in PRE_PAGO_FIELDS)


def query_monthly_payments(
    db: Session,
    company_id: int | None = None,
    anio: int | None = None,
    mes: int | None = None,
    tipo_servicio: str | None = None,
    pagada: bool | None = None,
) -> list[MonthlyPayment]:
    stmt = select(MonthlyPayment)
    if company_id:
        stmt = stmt.where(MonthlyPayment.company_id == company_id)
    if anio:
        stmt = stmt.where(MonthlyPayment.anio == anio)
    if mes:
        stmt = stmt.where(MonthlyPayment.mes == mes)
    if tipo_servicio:
        stmt = stmt.where(MonthlyPayment.tipo_servicio.ilike(tipo_servicio))
    if pagada is not None:
        stmt = stmt.where(MonthlyPayment.pagada.is_(pagada))
    stmt = stmt.order_by(MonthlyPayment.anio.desc(), MonthlyPayment.mes.desc(), MonthlyPayment.tipo_servicio)
    return list(db.scalars(stmt).all())
