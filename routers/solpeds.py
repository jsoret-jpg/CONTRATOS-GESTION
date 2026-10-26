import io
import os
import uuid
from decimal import Decimal

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from dependencies import get_current_user, require_permission
from exports.templates import build_data_workbook, build_template_workbook
from imports.solped_import import EXPECTED_COLUMNS, validate_and_prepare
from models.attachment import Attachment
from models.company import Company
from models.contract import Contract
from models.provider import Provider
from models.servicio_producto import ServicioProducto
from models.solped import Solped
from models.user import User
from schemas.solped import (
    ImportErrorItem,
    ImportSummary,
    SolpedCreate,
    SolpedOut,
    SolpedSummary,
    SolpedUpdate,
)
from services.solped_service import query_solpeds
from services.budget_service import register_solped_execution

router = APIRouter(prefix="/solpeds", tags=["solpeds"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

EXPORT_HEADERS = [
    "numero_solped",
    "empresa",
    "tipo",
    "descripcion",
    "fecha_solped",
    "proveedor",
    "numero_orden",
    "monto_orden",
    "moneda",
    "estado",
    "presupuestada",
    "monto_presupuesto",
    "monto_ejecutado",
    "saldo",
    "fecha_ejecucion",
    "observaciones",
]

TEMPLATE_EXAMPLE_ROW = [
    "SOL-2026-0001",
    "Oregon Foods",
    "PRODUCTO",
    "Compra de laptops para el área de sistemas",
    "2026-01-15",
    "Proveedor Ejemplo SAC",
    "OC-2026-0001",
    1500.00,
    "PEN",
    "aprobado_nivel_1",
    "SI",
    1500.00,
    0,
    "",
    "Fila de ejemplo, bórrala antes de importar",
]

TEMPLATE_INSTRUCTIONS = [
    "Instrucciones para importar SOLPEDs",
    "",
    "- numero_solped: identificador único de la SOLPED. Si ya existe, se actualiza el registro (no se duplica).",
    "- empresa: debe coincidir con el nombre o código de una empresa existente.",
    "- tipo: PRODUCTO o SERVICIO.",
    "- descripcion: texto libre opcional, qué es lo que se está solicitando.",
    "- fecha_solped y fecha_ejecucion: formato AAAA-MM-DD (fecha_ejecucion es opcional).",
    "- proveedor: nombre del proveedor. Si no existe en el sistema, se crea automáticamente.",
    "- numero_orden: opcional.",
    "- monto_orden: obligatorio, numérico.",
    "- moneda: PEN o USD.",
    (
        "- estado: uno de aprobado_nivel_1, aprobado_nivel_2, aprobado_nivel_3, aprobado_nivel_4, "
        "orden_registrada, orden_enviada, factura_registrada, factura_pagada."
    ),
    "- presupuestada: SI o NO.",
    "- monto_presupuesto y monto_ejecutado: opcionales, numéricos.",
    "- observaciones: texto libre, opcional.",
]


def _to_row(s: Solped, companies: dict[int, Company], providers: dict[int, Provider]) -> list:
    saldo = None
    if s.monto_presupuesto is not None and s.monto_ejecutado is not None:
        saldo = float(s.monto_presupuesto - s.monto_ejecutado)
    return [
        s.numero_solped,
        companies[s.company_id].name if s.company_id in companies else "",
        s.tipo,
        s.descripcion or "",
        s.fecha_solped.isoformat(),
        providers[s.provider_id].name if s.provider_id in providers else "",
        s.numero_orden or "",
        float(s.monto_orden),
        s.moneda,
        s.estado,
        "SI" if s.presupuestada else "NO",
        float(s.monto_presupuesto) if s.monto_presupuesto is not None else "",
        float(s.monto_ejecutado) if s.monto_ejecutado is not None else "",
        saldo if saldo is not None else "",
        s.fecha_ejecucion.isoformat() if s.fecha_ejecucion else "",
        s.observaciones or "",
    ]


def _serialize_solped(db: Session, solped: Solped, alerta: str | None = None) -> SolpedOut:
    result = SolpedOut.model_validate(solped)
    if solped.servicio_producto_id:
        servicio_producto = db.get(ServicioProducto, solped.servicio_producto_id)
        result.servicio_producto_nombre = servicio_producto.nombre if servicio_producto else None
    if solped.contract_id:
        contract = db.get(Contract, solped.contract_id)
        result.contract_numero = contract.numero_contrato if contract else None
    result.presupuesto_alerta = alerta
    return result


def _serialize_solpeds(db: Session, solpeds: list[Solped]) -> list[SolpedOut]:
    nombres = {sp.id: sp.nombre for sp in db.scalars(select(ServicioProducto))}
    contratos = {c.id: c.numero_contrato for c in db.scalars(select(Contract))}
    results = []
    for solped in solpeds:
        out = SolpedOut.model_validate(solped)
        if solped.servicio_producto_id:
            out.servicio_producto_nombre = nombres.get(solped.servicio_producto_id)
        if solped.contract_id:
            out.contract_numero = contratos.get(solped.contract_id)
        results.append(out)
    return results


# --- Rutas estáticas primero: deben declararse antes de "/{solped_id}" ---


@router.get("/template", dependencies=[Depends(require_permission("solped", "import"))])
def download_template():
    content = build_template_workbook(EXPECTED_COLUMNS, TEMPLATE_EXAMPLE_ROW, TEMPLATE_INSTRUCTIONS)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=plantilla_solpeds.xlsx"},
    )


@router.get("/export", dependencies=[Depends(require_permission("solped", "export"))])
def export_solpeds(
    db: Session = Depends(get_db),
    estado: str | None = Query(None),
    company_id: int | None = Query(None),
    tipo: str | None = Query(None),
    moneda: str | None = Query(None),
    provider_id: int | None = Query(None),
    search: str | None = Query(None),
):
    solpeds = query_solpeds(db, estado, company_id, tipo, moneda, provider_id, search)
    companies = {c.id: c for c in db.scalars(select(Company))}
    providers = {p.id: p for p in db.scalars(select(Provider))}

    rows = [_to_row(s, companies, providers) for s in solpeds]
    content = build_data_workbook(EXPORT_HEADERS, rows)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=solpeds_export.xlsx"},
    )


@router.post("/import", response_model=ImportSummary, dependencies=[Depends(require_permission("solped", "import"))])
async def import_solpeds(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx o .xls)")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents), sheet_name=0, dtype=object)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {exc}") from exc

    df.columns = [str(c).strip().lower() for c in df.columns]

    try:
        to_create, to_update, errors = validate_and_prepare(df, db)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.commit()

    return ImportSummary(
        insertados=len(to_create),
        actualizados=len(to_update),
        rechazados=len(errors),
        errores=[ImportErrorItem(**e) for e in errors],
    )


@router.get(
    "/summary/dashboard",
    response_model=SolpedSummary,
    dependencies=[Depends(require_permission("solped", "view"))],
)
def solped_summary(
    db: Session = Depends(get_db),
    estado: str | None = Query(None),
    company_id: int | None = Query(None),
    tipo: str | None = Query(None),
    moneda: str | None = Query(None),
    provider_id: int | None = Query(None),
    search: str | None = Query(None),
    excluir_estado: str | None = Query(None),
):
    solpeds = query_solpeds(db, estado, company_id, tipo, moneda, provider_id, search, excluir_estado)
    por_estado: dict[str, int] = {}
    total_por_moneda: dict[str, Decimal] = {}
    for s in solpeds:
        por_estado[s.estado] = por_estado.get(s.estado, 0) + 1
        total_por_moneda[s.moneda] = total_por_moneda.get(s.moneda, Decimal("0")) + s.monto_orden
    return SolpedSummary(total_solpeds=len(solpeds), por_estado=por_estado, total_por_moneda=total_por_moneda)


# --- CRUD ---


@router.get("", response_model=list[SolpedOut], dependencies=[Depends(require_permission("solped", "view"))])
def list_solpeds(
    db: Session = Depends(get_db),
    estado: str | None = Query(None),
    company_id: int | None = Query(None),
    tipo: str | None = Query(None),
    moneda: str | None = Query(None),
    provider_id: int | None = Query(None),
    search: str | None = Query(None),
    excluir_estado: str | None = Query(None),
):
    solpeds = query_solpeds(db, estado, company_id, tipo, moneda, provider_id, search, excluir_estado)
    return _serialize_solpeds(db, solpeds)


@router.post(
    "",
    response_model=SolpedOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("solped", "create"))],
)
def create_solped(payload: SolpedCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.scalar(select(Solped).where(Solped.numero_solped == payload.numero_solped)):
        raise HTTPException(status_code=400, detail="Ya existe una SOLPED con ese número")
    if not db.get(Company, payload.company_id):
        raise HTTPException(status_code=400, detail="Empresa no válida")
    if payload.provider_id and not db.get(Provider, payload.provider_id):
        raise HTTPException(status_code=400, detail="Proveedor no válido")
    if payload.contract_id and not db.get(Contract, payload.contract_id):
        raise HTTPException(status_code=400, detail="Contrato no válido")

    solped = Solped(**payload.model_dump(), created_by=current_user.id)
    db.add(solped)
    db.commit()
    db.refresh(solped)

    alerta = register_solped_execution(db, solped)
    db.refresh(solped)

    return _serialize_solped(db, solped, alerta)


@router.get("/{solped_id}", response_model=SolpedOut, dependencies=[Depends(require_permission("solped", "view"))])
def get_solped(solped_id: int, db: Session = Depends(get_db)):
    solped = db.get(Solped, solped_id)
    if not solped:
        raise HTTPException(status_code=404, detail="SOLPED no encontrada")
    return _serialize_solped(db, solped)


@router.put("/{solped_id}", response_model=SolpedOut, dependencies=[Depends(require_permission("solped", "edit"))])
def update_solped(solped_id: int, payload: SolpedUpdate, db: Session = Depends(get_db)):
    solped = db.get(Solped, solped_id)
    if not solped:
        raise HTTPException(status_code=404, detail="SOLPED no encontrada")

    data = payload.model_dump(exclude_unset=True)
    if "company_id" in data and not db.get(Company, data["company_id"]):
        raise HTTPException(status_code=400, detail="Empresa no válida")
    if "provider_id" in data and data["provider_id"] is not None and not db.get(Provider, data["provider_id"]):
        raise HTTPException(status_code=400, detail="Proveedor no válido")
    if "contract_id" in data and data["contract_id"] is not None and not db.get(Contract, data["contract_id"]):
        raise HTTPException(status_code=400, detail="Contrato no válido")

    for field, value in data.items():
        setattr(solped, field, value)

    db.commit()
    db.refresh(solped)

    alerta = register_solped_execution(db, solped)
    db.refresh(solped)

    return _serialize_solped(db, solped, alerta)


@router.delete(
    "/{solped_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("solped", "delete"))]
)
def delete_solped(solped_id: int, db: Session = Depends(get_db)):
    solped = db.get(Solped, solped_id)
    if not solped:
        raise HTTPException(status_code=404, detail="SOLPED no encontrada")
    db.delete(solped)
    db.commit()


# --- Cotización adjunta (archivo real en el volumen Docker) ---


@router.post(
    "/{solped_id}/cotizacion",
    response_model=SolpedOut,
    dependencies=[Depends(require_permission("solped", "edit"))],
)
async def upload_cotizacion(
    solped_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    solped = db.get(Solped, solped_id)
    if not solped:
        raise HTTPException(status_code=404, detail="SOLPED no encontrada")

    folder = os.path.join(settings.STORAGE_PATH, "solpeds", str(solped_id))
    os.makedirs(folder, exist_ok=True)

    contents = await file.read()
    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    path = os.path.join(folder, safe_name)
    with open(path, "wb") as f:
        f.write(contents)

    existing = db.scalar(
        select(Attachment).where(
            Attachment.tabla_origen == "solped_cotizacion", Attachment.registro_id == solped_id
        )
    )
    if existing:
        old_path = existing.ruta_archivo
        db.delete(existing)
        db.flush()
        if os.path.exists(old_path):
            os.remove(old_path)

    attachment = Attachment(
        tabla_origen="solped_cotizacion",
        registro_id=solped_id,
        nombre_archivo=file.filename or safe_name,
        ruta_archivo=path,
        tipo_mime=file.content_type,
        tamano=len(contents),
        subido_por=current_user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(solped)
    return _serialize_solped(db, solped)


@router.get("/{solped_id}/cotizacion", dependencies=[Depends(require_permission("solped", "view"))])
def download_cotizacion(solped_id: int, db: Session = Depends(get_db)):
    attachment = db.scalar(
        select(Attachment).where(
            Attachment.tabla_origen == "solped_cotizacion", Attachment.registro_id == solped_id
        )
    )
    if not attachment or not os.path.exists(attachment.ruta_archivo):
        raise HTTPException(status_code=404, detail="Esta SOLPED no tiene cotización adjunta")

    return FileResponse(
        attachment.ruta_archivo,
        filename=attachment.nombre_archivo,
        media_type=attachment.tipo_mime or "application/octet-stream",
    )
