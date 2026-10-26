import io
from decimal import Decimal

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_permission
from exports.templates import build_data_workbook, build_template_workbook
from imports.computer_leasing_import import EXPECTED_COLUMNS, validate_and_prepare
from models.company import Company
from models.computer_leasing import ComputerLeasing
from models.provider import Provider
from models.user import User
from schemas.computer_leasing import (
    ComputerLeasingCreate,
    ComputerLeasingOut,
    ComputerLeasingSummary,
    ComputerLeasingUpdate,
    ImportErrorItem,
    ImportSummary,
)
from app.services.computer_leasing_service import query_computer_leasing
from app.utils.renovacion_calculator import (
    compute_dias_para_renovacion,
    compute_renovacion_estado,
    compute_renovacion_texto,
)

router = APIRouter(prefix="/leasing/computers", tags=["leasing-computers"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
SIN_CONTRATO_LABEL = "Sin contrato"

EXPORT_HEADERS = [
    "empresa",
    "area",
    "proceso",
    "usuario",
    "precio",
    "contrato",
    "proveedor",
    "fecha_asignacion",
    "fecha_renovacion",
    "dias_para_renovacion",
    "renovacion",
    "equipo",
    "modelo",
    "observaciones",
]

TEMPLATE_EXAMPLE_ROW = [
    "Oregon Foods",
    "Sistemas",
    "Infraestructura",
    "Juan Pérez",
    1200.00,
    "CTR-2026-0001",
    "Proveedor Ejemplo SAC",
    "2026-01-01",
    "2027-12-31",
    "Laptop",
    "Dell Latitude 5420",
    "Fila de ejemplo, bórrala antes de importar",
]

TEMPLATE_INSTRUCTIONS = [
    "Instrucciones para importar Leasing de computadoras",
    "",
    "- empresa: debe coincidir con el nombre o código de una empresa existente.",
    "- area, proceso, usuario: opcionales, texto libre.",
    "- precio: obligatorio, numérico.",
    "- contrato: referencia libre al contrato de leasing (opcional). Si se deja vacío, se muestra como 'Sin contrato'.",
    "- proveedor: nombre del proveedor. Si no existe en el sistema, se crea automáticamente.",
    "- fecha_asignacion: fecha en que el equipo fue asignado al usuario. Formato AAAA-MM-DD, obligatoria.",
    "- fecha_renovacion: fecha en que corresponde renovar el leasing/equipo. Formato AAAA-MM-DD, obligatoria.",
    "- equipo: obligatorio (ej. Laptop, Desktop, Impresora).",
    "- modelo: opcional.",
    "- observaciones: texto libre, opcional.",
    "- Cada fila del Excel crea un registro nuevo (no hay actualización por duplicado en este módulo).",
    "- Los días para renovación se calculan automáticamente a partir de fecha_renovacion, no se importan.",
]


def _to_row(item: ComputerLeasing, companies: dict[int, Company], providers: dict[int, Provider]) -> list:
    dias = compute_dias_para_renovacion(item.fecha_renovacion)
    return [
        companies[item.company_id].name if item.company_id in companies else "",
        item.area or "",
        item.proceso or "",
        item.usuario or "",
        float(item.precio),
        item.contrato or SIN_CONTRATO_LABEL,
        providers[item.provider_id].name if item.provider_id in providers else "",
        item.fecha_asignacion.isoformat(),
        item.fecha_renovacion.isoformat(),
        dias,
        compute_renovacion_texto(dias),
        item.equipo,
        item.modelo or "",
        item.observaciones or "",
    ]


# --- Rutas estáticas primero ---


@router.get("/template", dependencies=[Depends(require_permission("leasing_computadora", "import"))])
def download_template():
    content = build_template_workbook(EXPECTED_COLUMNS, TEMPLATE_EXAMPLE_ROW, TEMPLATE_INSTRUCTIONS)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=plantilla_leasing_computadoras.xlsx"},
    )


@router.get("/export", dependencies=[Depends(require_permission("leasing_computadora", "export"))])
def export_computer_leasing(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    proceso: str | None = Query(None),
    estado: str | None = Query(None),
    search: str | None = Query(None),
    contrato: str | None = Query(None),
    sin_contrato: bool = Query(False),
):
    items = query_computer_leasing(db, company_id, proceso, estado, search, contrato, sin_contrato)
    companies = {c.id: c for c in db.scalars(select(Company))}
    providers = {p.id: p for p in db.scalars(select(Provider))}

    rows = [_to_row(item, companies, providers) for item in items]
    content = build_data_workbook(EXPORT_HEADERS, rows)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=leasing_computadoras_export.xlsx"},
    )


@router.post(
    "/import",
    response_model=ImportSummary,
    dependencies=[Depends(require_permission("leasing_computadora", "import"))],
)
async def import_computer_leasing(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx o .xls)")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents), sheet_name=0, dtype=object)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {exc}") from exc

    df.columns = [str(c).strip().lower() for c in df.columns]

    try:
        to_create, errors = validate_and_prepare(df, db)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.commit()

    return ImportSummary(
        insertados=len(to_create),
        actualizados=0,
        rechazados=len(errors),
        errores=[ImportErrorItem(**e) for e in errors],
    )


@router.get(
    "/summary/dashboard",
    response_model=ComputerLeasingSummary,
    dependencies=[Depends(require_permission("leasing_computadora", "view"))],
)
def computer_leasing_summary(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    proceso: str | None = Query(None),
    estado: str | None = Query(None),
    search: str | None = Query(None),
    contrato: str | None = Query(None),
    sin_contrato: bool = Query(False),
):
    items = query_computer_leasing(db, company_id, proceso, estado, search, contrato, sin_contrato)
    companies = {c.id: c.name for c in db.scalars(select(Company))}

    por_estado: dict[str, int] = {}
    total_por_empresa: dict[str, Decimal] = {}
    total_por_proceso: dict[str, Decimal] = {}
    total_por_contrato: dict[str, Decimal] = {}

    for item in items:
        dias = compute_dias_para_renovacion(item.fecha_renovacion)
        estado = compute_renovacion_estado(dias)
        por_estado[estado] = por_estado.get(estado, 0) + 1

        empresa_nombre = companies.get(item.company_id, "Sin asignar")
        total_por_empresa[empresa_nombre] = total_por_empresa.get(empresa_nombre, Decimal("0")) + item.precio

        proceso_nombre = item.proceso or "Sin proceso"
        total_por_proceso[proceso_nombre] = total_por_proceso.get(proceso_nombre, Decimal("0")) + item.precio

        contrato_nombre = item.contrato or SIN_CONTRATO_LABEL
        total_por_contrato[contrato_nombre] = total_por_contrato.get(contrato_nombre, Decimal("0")) + item.precio

    return ComputerLeasingSummary(
        total=len(items),
        por_estado=por_estado,
        total_por_empresa=total_por_empresa,
        total_por_proceso=total_por_proceso,
        total_por_contrato=total_por_contrato,
    )


# --- CRUD ---


@router.get(
    "",
    response_model=list[ComputerLeasingOut],
    dependencies=[Depends(require_permission("leasing_computadora", "view"))],
)
def list_computer_leasing(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    proceso: str | None = Query(None),
    estado: str | None = Query(None),
    search: str | None = Query(None),
    contrato: str | None = Query(None),
    sin_contrato: bool = Query(False),
):
    return query_computer_leasing(db, company_id, proceso, estado, search, contrato, sin_contrato)


@router.post(
    "",
    response_model=ComputerLeasingOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("leasing_computadora", "create"))],
)
def create_computer_leasing(
    payload: ComputerLeasingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.get(Company, payload.company_id):
        raise HTTPException(status_code=400, detail="Empresa no válida")
    if payload.provider_id and not db.get(Provider, payload.provider_id):
        raise HTTPException(status_code=400, detail="Proveedor no válido")
    if payload.fecha_renovacion < payload.fecha_asignacion:
        raise HTTPException(
            status_code=400, detail="La fecha de renovación no puede ser anterior a la fecha de asignación"
        )

    item = ComputerLeasing(**payload.model_dump(), created_by=current_user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get(
    "/{item_id}",
    response_model=ComputerLeasingOut,
    dependencies=[Depends(require_permission("leasing_computadora", "view"))],
)
def get_computer_leasing(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ComputerLeasing, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return item


@router.put(
    "/{item_id}",
    response_model=ComputerLeasingOut,
    dependencies=[Depends(require_permission("leasing_computadora", "edit"))],
)
def update_computer_leasing(item_id: int, payload: ComputerLeasingUpdate, db: Session = Depends(get_db)):
    item = db.get(ComputerLeasing, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    data = payload.model_dump(exclude_unset=True)
    if "company_id" in data and not db.get(Company, data["company_id"]):
        raise HTTPException(status_code=400, detail="Empresa no válida")
    if "provider_id" in data and data["provider_id"] is not None and not db.get(Provider, data["provider_id"]):
        raise HTTPException(status_code=400, detail="Proveedor no válido")

    new_fecha_asignacion = data.get("fecha_asignacion", item.fecha_asignacion)
    new_fecha_renovacion = data.get("fecha_renovacion", item.fecha_renovacion)
    if new_fecha_renovacion < new_fecha_asignacion:
        raise HTTPException(
            status_code=400, detail="La fecha de renovación no puede ser anterior a la fecha de asignación"
        )

    for field, value in data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("leasing_computadora", "delete"))],
)
def delete_computer_leasing(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ComputerLeasing, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    db.delete(item)
    db.commit()
