from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models.servicio_producto import ServicioProducto
from models.solped import Solped


def query_solpeds(
    db: Session,
    estado: str | None = None,
    company_id: int | None = None,
    tipo: str | None = None,
    moneda: str | None = None,
    provider_id: int | None = None,
    search: str | None = None,
    excluir_estado: str | None = None,
) -> list[Solped]:
    stmt = select(Solped)
    if estado:
        stmt = stmt.where(Solped.estado == estado)
    if excluir_estado:
        stmt = stmt.where(Solped.estado != excluir_estado)
    if company_id:
        stmt = stmt.where(Solped.company_id == company_id)
    if tipo:
        stmt = stmt.where(Solped.tipo == tipo)
    if moneda:
        stmt = stmt.where(Solped.moneda == moneda)
    if provider_id:
        stmt = stmt.where(Solped.provider_id == provider_id)
    if search:
        # La búsqueda combina N.º SOLPED y el nombre del servicio/producto
        # vinculado, ya que ambos son formas naturales de encontrar una SOLPED.
        servicios_coincidentes = select(ServicioProducto.id).where(ServicioProducto.nombre.ilike(f"%{search}%"))
        stmt = stmt.where(
            or_(
                Solped.numero_solped.ilike(f"%{search}%"),
                Solped.servicio_producto_id.in_(servicios_coincidentes),
            )
        )
    stmt = stmt.order_by(Solped.fecha_solped.desc(), Solped.id.desc())
    return list(db.scalars(stmt).all())
