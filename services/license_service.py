from sqlalchemy import select
from sqlalchemy.orm import Session

from models.license import License


def query_licenses(
    db: Session,
    company_id: int | None = None,
    tipo: str | None = None,
    proceso: str | None = None,
    search: str | None = None,
) -> list[License]:
    stmt = select(License)
    if company_id:
        stmt = stmt.where(License.company_id == company_id)
    if tipo:
        stmt = stmt.where(License.tipo.ilike(tipo))
    if proceso:
        stmt = stmt.where(License.proceso.ilike(proceso))
    if search:
        like = f"%{search}%"
        stmt = stmt.where((License.usuario.ilike(like)) | (License.cuenta.ilike(like)))
    stmt = stmt.order_by(License.tipo.asc(), License.id.desc())
    return list(db.scalars(stmt).all())
