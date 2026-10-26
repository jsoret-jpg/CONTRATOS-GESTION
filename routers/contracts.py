import io
import os
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.exports.templates import build_data_workbook, build_template_workbook
from app.imports.contract_import import EXPECTED_COLUMNS, validate_and_prepare
from app.models.attachment import Attachment
from app.models.company import Company
from app.models.contract import Contract
from app.models.provider import Provider
from app.models.user import User
from app.schemas.contract import (
    ContractCreate,
    ContractOut,
    ContractSummary,
    ContractUpdate,
    ImportErrorItem,
    ImportSummary,
)
from app.services.contract_service import (
    compute_contract_estado,
    compute_meses_faltantes,
    query_contracts,
)

router = APIRouter(prefix="/contracts", tags=["contracts"])

ATTACHMENT_TABLA_ORIGEN = "contrato"

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

EXPORT_HEADERS = [
    "numero_contrato",
    "empresa",
    "descripcion_servicio",
    "cantidad",
    "sede",
    "fecha_inicio",
    "fecha_fin",
    "meses_faltantes",
    "estado",
    "tipo_contrato",
    "monto_igv",
    "proveedor",
    "observaciones",
]

TEMPLATE_EXAMPLE_ROW = [
    "CTR-2026-0001",
    "Oregon Foods",
    "Enlace de internet dedicado 100 Mbps",
    1,
    "Planta Lima",
    "2026-01-01",
    "2026-12-31",
    "Servicio",
    5000.00,
    "Proveedor Ejemplo SAC",
    "Fila de ejemplo, bórrala antes de importar",
]

TEMPLATE_INSTRUCTIONS = [
    "Instrucciones para importar Contratos",
    "",
    "- numero_contrato: identificador único (número de circuito/contrato). Si ya existe, se actualiza el registro.",
    "- empresa: debe coincidir con el nombre o código de una empresa existente.",
    "- descripcion_servicio: obligatoria, texto libre.",
    "- cantidad: numérica, opcional (por defecto 1).",
    "- sede: opcional.",
    "- fecha_inicio y fecha_fin: formato AAAA-MM-DD, ambas obligatorias.",
    "- tipo_contrato: texto libre (ej. Arrendamiento, Servicio, Mantenimiento, Suministro).",
    "- monto_igv: obligatorio, numérico (monto total del contrato con IGV incluido).",
    "- proveedor: nombre del proveedor. Si no existe en el sistema, se crea automáticamente.",
    "- observaciones: texto libre, opcional.",
    "- meses_faltantes y estado se calculan automáticamente a partir de fecha_fin: no se importan ni se editan a mano.",
]


def _to_row(c: Contract, companies: dict[int, Company], providers: dict[int, Provider]) -> list:
    return [
        c.numero_contrato,
        companies[c.company_id].name if c.company_id in companies else "",
        c.descripcion_servicio,
        c.cantidad,
        c.sede or "",
        c.fecha_inicio.isoformat(),
        c.fecha_fin.isoformat(),
        compute_meses_faltantes(c.fecha_fin),
        compute_contract_estado(c.fecha_fin, c.tipo_contrato),
        c.tipo_contrato,
        float(c.monto_igv),
        providers[c.provider_id].name if c.provider_id in providers else "",
        c.observaciones or "",
    ]


def _serialize_contract(db: Session, contract: Contract) -> ContractOut:
    result = ContractOut.model_validate(contract)
    result.tiene_archivo = bool(
        db.scalar(
            select(Attachment.id).where(
                Attachment.tabla_origen == ATTACHMENT_TABLA_ORIGEN, Attachment.registro_id == contract.id
            )
        )
    )
    return result


def _serialize_contracts(db: Session, contracts: list[Contract]) -> list[ContractOut]:
    con_archivo = {
        a.registro_id
        for a in db.scalars(select(Attachment).where(Attachment.tabla_origen == ATTACHMENT_TABLA_ORIGEN))
    }
    results = []
    for contract in contracts:
        out = ContractOut.model_validate(contract)
        out.tiene_archivo = contract.id in con_archivo
        results.append(out)
    return results


# --- Rutas estáticas primero: deben declararse antes de "/{contract_id}" ---


@router.get("/template", dependencies=[Depends(require_permission("contrato", "import"))])
def download_template():
    content = build_template_workbook(EXPECTED_COLUMNS, TEMPLATE_EXAMPLE_ROW, TEMPLATE_INSTRUCTIONS)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=plantilla_contratos.xlsx"},
    )


@router.get("/export", dependencies=[Depends(require_permission("contrato", "export"))])
def export_contracts(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    tipo_contrato: str | None = Query(None),
    estado: str | None = Query(None),
    search: str | None = Query(None),
):
    contracts = query_contracts(db, company_id, tipo_contrato, estado, search)
    companies = {c.id: c for c in db.scalars(select(Company))}
    providers = {p.id: p for p in db.scalars(select(Provider))}

    rows = [_to_row(c, companies, providers) for c in contracts]
    content = build_data_workbook(EXPORT_HEADERS, rows)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=contratos_export.xlsx"},
    )


@router.post(
    "/import", response_model=ImportSummary, dependencies=[Depends(require_permission("contrato", "import"))]
)
async def import_contracts(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
    response_model=ContractSummary,
    dependencies=[Depends(require_permission("contrato", "view"))],
)
def contract_summary(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    tipo_contrato: str | None = Query(None),
    estado: str | None = Query(None),
    search: str | None = Query(None),
):
    contracts = query_contracts(db, company_id, tipo_contrato, estado, search)
    por_estado: dict[str, int] = {}
    for c in contracts:
        estado_calculado = compute_contract_estado(c.fecha_fin, c.tipo_contrato)
        por_estado[estado_calculado] = por_estado.get(estado_calculado, 0) + 1
    return ContractSummary(total_contratos=len(contracts), por_estado=por_estado)


# --- CRUD ---


@router.get("", response_model=list[ContractOut], dependencies=[Depends(require_permission("contrato", "view"))])
def list_contracts(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    tipo_contrato: str | None = Query(None),
    estado: str | None = Query(None),
    search: str | None = Query(None),
):
    contracts = query_contracts(db, company_id, tipo_contrato, estado, search)
    return _serialize_contracts(db, contracts)


@router.post(
    "",
    response_model=ContractOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("contrato", "create"))],
)
def create_contract(
    payload: ContractCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    data = payload.model_dump()
    numero_contrato = (data.get("numero_contrato") or "").strip()
    if not numero_contrato:
        numero_contrato = f"SIN-NUMERO-{uuid.uuid4().hex[:8].upper()}"
    data["numero_contrato"] = numero_contrato

    if db.scalar(select(Contract).where(Contract.numero_contrato == numero_contrato)):
        raise HTTPException(status_code=400, detail="Ya existe un contrato con ese número")
    if not db.get(Company, data["company_id"]):
        raise HTTPException(status_code=400, detail="Empresa no válida")
    if data.get("provider_id") and not db.get(Provider, data["provider_id"]):
        raise HTTPException(status_code=400, detail="Proveedor no válido")
    if data["fecha_fin"] < data["fecha_inicio"]:
        raise HTTPException(status_code=400, detail="La fecha de fin no puede ser anterior a la fecha de inicio")

    contract = Contract(**data, created_by=current_user.id)
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return _serialize_contract(db, contract)


@router.get(
    "/{contract_id}", response_model=ContractOut, dependencies=[Depends(require_permission("contrato", "view"))]
)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return _serialize_contract(db, contract)


@router.put(
    "/{contract_id}", response_model=ContractOut, dependencies=[Depends(require_permission("contrato", "edit"))]
)
def update_contract(contract_id: int, payload: ContractUpdate, db: Session = Depends(get_db)):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    data = payload.model_dump(exclude_unset=True)
    if "company_id" in data and not db.get(Company, data["company_id"]):
        raise HTTPException(status_code=400, detail="Empresa no válida")
    if "provider_id" in data and data["provider_id"] is not None and not db.get(Provider, data["provider_id"]):
        raise HTTPException(status_code=400, detail="Proveedor no válido")

    new_fecha_inicio = data.get("fecha_inicio", contract.fecha_inicio)
    new_fecha_fin = data.get("fecha_fin", contract.fecha_fin)
    if new_fecha_fin < new_fecha_inicio:
        raise HTTPException(status_code=400, detail="La fecha de fin no puede ser anterior a la fecha de inicio")

    for field, value in data.items():
        setattr(contract, field, value)

    db.commit()
    db.refresh(contract)
    return _serialize_contract(db, contract)


@router.delete(
    "/{contract_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("contrato", "delete"))],
)
def delete_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    db.delete(contract)
    db.commit()


# --- Contrato adjunto (archivo real en el volumen Docker) ---


@router.post(
    "/{contract_id}/archivo",
    response_model=ContractOut,
    dependencies=[Depends(require_permission("contrato", "edit"))],
)
async def upload_contract_file(
    contract_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    folder = os.path.join(settings.STORAGE_PATH, "contracts", str(contract_id))
    os.makedirs(folder, exist_ok=True)

    contents = await file.read()
    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    path = os.path.join(folder, safe_name)
    with open(path, "wb") as f:
        f.write(contents)

    existing = db.scalar(
        select(Attachment).where(
            Attachment.tabla_origen == ATTACHMENT_TABLA_ORIGEN, Attachment.registro_id == contract_id
        )
    )
    if existing:
        old_path = existing.ruta_archivo
        db.delete(existing)
        db.flush()
        if os.path.exists(old_path):
            os.remove(old_path)

    attachment = Attachment(
        tabla_origen=ATTACHMENT_TABLA_ORIGEN,
        registro_id=contract_id,
        nombre_archivo=file.filename or safe_name,
        ruta_archivo=path,
        tipo_mime=file.content_type,
        tamano=len(contents),
        subido_por=current_user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(contract)
    return _serialize_contract(db, contract)


@router.get("/{contract_id}/archivo", dependencies=[Depends(require_permission("contrato", "view"))])
def download_contract_file(contract_id: int, db: Session = Depends(get_db)):
    attachment = db.scalar(
        select(Attachment).where(
            Attachment.tabla_origen == ATTACHMENT_TABLA_ORIGEN, Attachment.registro_id == contract_id
        )
    )
    if not attachment or not os.path.exists(attachment.ruta_archivo):
        raise HTTPException(status_code=404, detail="Este contrato no tiene archivo adjunto")

    return FileResponse(
        attachment.ruta_archivo,
        filename=attachment.nombre_archivo,
        media_type=attachment.tipo_mime or "application/octet-stream",
    )


@router.delete(
    "/{contract_id}/archivo",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("contrato", "edit"))],
)
def delete_contract_file(contract_id: int, db: Session = Depends(get_db)):
    attachment = db.scalar(
        select(Attachment).where(
            Attachment.tabla_origen == ATTACHMENT_TABLA_ORIGEN, Attachment.registro_id == contract_id
        )
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Este contrato no tiene archivo adjunto")
    if os.path.exists(attachment.ruta_archivo):
        os.remove(attachment.ruta_archivo)
    db.delete(attachment)
    db.commit()
