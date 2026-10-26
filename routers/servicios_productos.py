from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permission
from app.models.servicio_producto import ServicioProducto
from app.schemas.servicio_producto import ServicioProductoCreate, ServicioProductoOut, ServicioProductoUpdate

router = APIRouter(prefix="/servicios-productos", tags=["servicios-productos"])


@router.get(
    "", response_model=list[ServicioProductoOut], dependencies=[Depends(require_permission("presupuesto", "view"))]
)
def list_servicios_productos(db: Session = Depends(get_db), incluir_inactivos: bool = Query(False)):
    stmt = select(ServicioProducto)
    if not incluir_inactivos:
        stmt = stmt.where(ServicioProducto.is_active.is_(True))
    stmt = stmt.order_by(ServicioProducto.nombre)
    return db.scalars(stmt).all()


@router.post(
    "",
    response_model=ServicioProductoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("presupuesto", "create"))],
)
def create_servicio_producto(payload: ServicioProductoCreate, db: Session = Depends(get_db)):
    nombre = payload.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    if db.scalar(select(ServicioProducto).where(ServicioProducto.nombre == nombre)):
        raise HTTPException(status_code=400, detail="Ya existe un servicio/producto con ese nombre")
    item = ServicioProducto(nombre=nombre)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put(
    "/{item_id}",
    response_model=ServicioProductoOut,
    dependencies=[Depends(require_permission("presupuesto", "edit"))],
)
def update_servicio_producto(item_id: int, payload: ServicioProductoUpdate, db: Session = Depends(get_db)):
    item = db.get(ServicioProducto, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Servicio/producto no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "nombre" in data and data["nombre"]:
        data["nombre"] = data["nombre"].strip()
        duplicate = db.scalar(
            select(ServicioProducto).where(
                ServicioProducto.nombre == data["nombre"], ServicioProducto.id != item_id
            )
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="Ya existe un servicio/producto con ese nombre")
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("presupuesto", "delete"))],
)
def delete_servicio_producto(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ServicioProducto, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Servicio/producto no encontrado")
    # No se borra si está en uso: se desactiva para no romper presupuestos o
    # SOLPEDs que ya lo referencian.
    item.is_active = False
    db.commit()
