from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permission
from app.models.invoice import Invoice
from app.models.solped import Solped
from app.schemas.invoice import InvoiceCreate, InvoiceOut, InvoiceUpdate
from app.services.budget_service import sync_solped_execution_from_invoices

router = APIRouter(prefix="/solpeds/{solped_id}/facturas", tags=["facturas"])

# Orden de avance del estado de la SOLPED: registrar/pagar una factura nunca
# retrocede el estado, solo lo empuja hacia adelante si corresponde.
ESTADO_ORDEN = [
    "aprobado_nivel_1",
    "aprobado_nivel_2",
    "aprobado_nivel_3",
    "aprobado_nivel_4",
    "orden_registrada",
    "orden_enviada",
    "factura_registrada",
    "factura_pagada",
]


def _avanzar_estado_solped(solped: Solped, nuevo_estado: str) -> None:
    actual_idx = ESTADO_ORDEN.index(solped.estado) if solped.estado in ESTADO_ORDEN else -1
    nuevo_idx = ESTADO_ORDEN.index(nuevo_estado)
    if nuevo_idx > actual_idx:
        solped.estado = nuevo_estado


def _get_solped_or_404(db: Session, solped_id: int) -> Solped:
    solped = db.get(Solped, solped_id)
    if not solped:
        raise HTTPException(status_code=404, detail="SOLPED no encontrada")
    return solped


@router.get("", response_model=list[InvoiceOut], dependencies=[Depends(require_permission("factura", "view"))])
def list_invoices(solped_id: int, db: Session = Depends(get_db)):
    _get_solped_or_404(db, solped_id)
    stmt = select(Invoice).where(Invoice.solped_id == solped_id).order_by(Invoice.fecha_factura.desc())
    return db.scalars(stmt).all()


@router.post(
    "",
    response_model=InvoiceOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("factura", "create"))],
)
def create_invoice(solped_id: int, payload: InvoiceCreate, db: Session = Depends(get_db)):
    solped = _get_solped_or_404(db, solped_id)

    existing = db.scalar(
        select(Invoice).where(Invoice.solped_id == solped_id, Invoice.numero_factura == payload.numero_factura)
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una factura con ese número para esta SOLPED")

    invoice = Invoice(solped_id=solped_id, **payload.model_dump())
    db.add(invoice)

    _avanzar_estado_solped(solped, "factura_pagada" if invoice.estado == "pagada" else "factura_registrada")

    db.commit()
    db.refresh(invoice)

    alerta = sync_solped_execution_from_invoices(db, solped)
    db.refresh(invoice)

    result = InvoiceOut.model_validate(invoice)
    result.presupuesto_alerta = alerta
    return result


@router.put(
    "/{invoice_id}",
    response_model=InvoiceOut,
    dependencies=[Depends(require_permission("factura", "edit"))],
)
def update_invoice(solped_id: int, invoice_id: int, payload: InvoiceUpdate, db: Session = Depends(get_db)):
    solped = _get_solped_or_404(db, solped_id)
    invoice = db.get(Invoice, invoice_id)
    if not invoice or invoice.solped_id != solped_id:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    data = payload.model_dump(exclude_unset=True)

    new_numero = data.get("numero_factura")
    if new_numero and new_numero != invoice.numero_factura:
        duplicate = db.scalar(
            select(Invoice).where(Invoice.solped_id == solped_id, Invoice.numero_factura == new_numero)
        )
        if duplicate:
            raise HTTPException(status_code=400, detail="Ya existe una factura con ese número para esta SOLPED")

    for field, value in data.items():
        setattr(invoice, field, value)

    if invoice.estado == "pagada":
        _avanzar_estado_solped(solped, "factura_pagada")
    elif invoice.estado == "registrada":
        _avanzar_estado_solped(solped, "factura_registrada")

    db.commit()
    db.refresh(invoice)

    alerta = sync_solped_execution_from_invoices(db, solped)
    db.refresh(invoice)

    result = InvoiceOut.model_validate(invoice)
    result.presupuesto_alerta = alerta
    return result


@router.delete(
    "/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("factura", "delete"))],
)
def delete_invoice(solped_id: int, invoice_id: int, db: Session = Depends(get_db)):
    solped = _get_solped_or_404(db, solped_id)
    invoice = db.get(Invoice, invoice_id)
    if not invoice or invoice.solped_id != solped_id:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    db.delete(invoice)
    db.commit()
    sync_solped_execution_from_invoices(db, solped)
