from sqlalchemy import select
from sqlalchemy.orm import Session

from models.contract import Contract
from utils.date_estado import compute_estado, compute_meses_faltantes

__all__ = ["compute_estado", "compute_contract_estado", "compute_meses_faltantes", "query_contracts"]


def compute_contract_estado(fecha_fin, tipo_contrato: str) -> str:
    """El tipo de contrato 'Libre' nunca vence: siempre se muestra como
    'vigente', sin importar la fecha de fin. Cualquier otro tipo (incluido
    'Contrato') sigue el cálculo normal por fecha. Las alertas de
    vencimiento, por separado, solo se generan para el tipo 'Contrato'
    exacto (ver notification_service.py)."""
    if (tipo_contrato or "").strip().lower() == "libre":
        return "vigente"
    return compute_estado(fecha_fin)


def query_contracts(
    db: Session,
    company_id: int | None = None,
    tipo_contrato: str | None = None,
    estado: str | None = None,
    search: str | None = None,
) -> list[Contract]:
    stmt = select(Contract)
    if company_id:
        stmt = stmt.where(Contract.company_id == company_id)
    if tipo_contrato:
        stmt = stmt.where(Contract.tipo_contrato.ilike(tipo_contrato))
    if search:
        stmt = stmt.where(Contract.numero_contrato.ilike(f"%{search}%"))
    stmt = stmt.order_by(Contract.fecha_fin.asc())

    contracts = list(db.scalars(stmt).all())

    # El estado es calculado, no está en la base de datos, así que el filtro
    # por estado se aplica en memoria después de traer los candidatos.
    if estado:
        contracts = [c for c in contracts if compute_contract_estado(c.fecha_fin, c.tipo_contrato) == estado]

    return contracts
