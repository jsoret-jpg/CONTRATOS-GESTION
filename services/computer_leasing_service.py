from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.computer_leasing import ComputerLeasing
from app.utils.renovacion_calculator import compute_dias_para_renovacion, compute_renovacion_estado


def query_computer_leasing(
    db: Session,
    company_id: int | None = None,
    proceso: str | None = None,
    estado: str | None = None,
    search: str | None = None,
    contrato: str | None = None,
    sin_contrato: bool = False,
) -> list[ComputerLeasing]:
    stmt = select(ComputerLeasing)
    if company_id:
        stmt = stmt.where(ComputerLeasing.company_id == company_id)
    if proceso:
        stmt = stmt.where(ComputerLeasing.proceso.ilike(proceso))
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            (ComputerLeasing.usuario.ilike(like))
            | (ComputerLeasing.equipo.ilike(like))
            | (ComputerLeasing.modelo.ilike(like))
        )
    if sin_contrato:
        stmt = stmt.where(ComputerLeasing.contrato.is_(None))
    elif contrato:
        stmt = stmt.where(ComputerLeasing.contrato == contrato)
    stmt = stmt.order_by(ComputerLeasing.fecha_renovacion.asc())

    items = list(db.scalars(stmt).all())
    if estado:
        items = [
            i for i in items if compute_renovacion_estado(compute_dias_para_renovacion(i.fecha_renovacion)) == estado
        ]
    return items
