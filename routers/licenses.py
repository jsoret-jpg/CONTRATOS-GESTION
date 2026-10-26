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
from imports.license_import import EXPECTED_COLUMNS, validate_and_prepare
from models.company import Company
from models.license import License
from models.user import User
from schemas.license import (
    ImportErrorItem,
    ImportSummary,
    LicenseCreate,
    LicenseOut,
    LicenseSummary,
    LicenseTypePriceUpdate,
    LicenseTypePriceUpdateResult,
    LicenseUpdate,
)
from app.services.license_service import query_licenses

router = APIRouter(prefix="/licenses", tags=["licenses"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

EXPORT_HEADERS = [
    "empresa",
    "area",
    "proceso",
    "tipo",
    "usuario",
    "cuenta",
    "precio",
    "moneda",
    "fecha_renovacion",
    "observaciones",
]

TEMPLATE_EXAMPLE_ROW = [
    "Oregon Foods",
    "Sistemas",
    "Infraestructura",
    "Microsoft 365",
    "Juan Pérez",
    "juan.perez@oregonfoods.com",
    45.00,
    "USD",
    "2027-01-15",
    "Fila de ejemplo, bórrala antes de importar",
]

TEMPLATE_INSTRUCTIONS = [
    "Instrucciones para importar Licencias",
    "",
    "- empresa: debe coincidir con el nombre o código de una empresa existente.",
    "- tipo: tipo de licencia (ej. Microsoft 365, Adobe, Antivirus).",
    "- cuenta: cuenta o correo asociado a la licencia. Obligatoria.",
    "- area, proceso, usuario: opcionales, texto libre.",
    "- precio: obligatorio, numérico.",
    "- moneda: PEN o USD.",
    "- fecha_renovacion: opcional, formato AAAA-MM-DD (fecha en que corresponde renovar la licencia).",
    "- La combinación empresa + cuenta + tipo es única: si ya existe, se actualiza el registro.",
    "- observaciones: texto libre, opcional.",
]


def _to_row(lic: License, companies: dict[int, Company]) -> list:
    return [
        companies[lic.company_id].name if lic.company_id in companies else "",
        lic.area or "",
        lic.proceso or "",
        lic.tipo,
        lic.usuario or "",
        lic.cuenta,
        float(lic.precio),
        lic.moneda,
        lic.fecha_renovacion.isoformat() if lic.fecha_renovacion else "",
        lic.observaciones or "",
    ]


# --- Rutas estáticas primero ---


@router.get("/template", dependencies=[Depends(require_permission("licencia", "import"))])
def download_template():
    content = build_template_workbook(EXPECTED_COLUMNS, TEMPLATE_EXAMPLE_ROW, TEMPLATE_INSTRUCTIONS)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=plantilla_licencias.xlsx"},
    )


@router.get("/export", dependencies=[Depends(require_permission("licencia", "export"))])
def export_licenses(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    tipo: str | None = Query(None),
    proceso: str | None = Query(None),
    search: str | None = Query(None),
):
    licenses = query_licenses(db, company_id, tipo, proceso, search)
    companies = {c.id: c for c in db.scalars(select(Company))}

    rows = [_to_row(lic, companies) for lic in licenses]
    content = build_data_workbook(EXPORT_HEADERS, rows)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=licencias_export.xlsx"},
    )


@router.post(
    "/import", response_model=ImportSummary, dependencies=[Depends(require_permission("licencia", "import"))]
)
async def import_licenses(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
    response_model=LicenseSummary,
    dependencies=[Depends(require_permission("licencia", "view"))],
)
def license_summary(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    tipo: str | None = Query(None),
    proceso: str | None = Query(None),
    search: str | None = Query(None),
):
    licenses = query_licenses(db, company_id, tipo, proceso, search)
    por_tipo: dict[str, int] = {}
    total_por_moneda: dict[str, Decimal] = {}
    for lic in licenses:
        por_tipo[lic.tipo] = por_tipo.get(lic.tipo, 0) + 1
        total_por_moneda[lic.moneda] = total_por_moneda.get(lic.moneda, Decimal("0")) + lic.precio
    return LicenseSummary(total_licencias=len(licenses), por_tipo=por_tipo, total_por_moneda=total_por_moneda)


@router.get(
    "/tipos",
    response_model=list[str],
    dependencies=[Depends(require_permission("licencia", "view"))],
)
def list_license_types(db: Session = Depends(get_db)):
    """Lista de tipos de licencia distintos ya registrados, para poblar el
    filtro y el selector de actualización de precio en cascada."""
    tipos = db.scalars(select(License.tipo).distinct().order_by(License.tipo)).all()
    return list(tipos)


@router.put(
    "/actualizar-precio-por-tipo",
    response_model=LicenseTypePriceUpdateResult,
    dependencies=[Depends(require_permission("licencia", "edit"))],
)
def update_price_by_type(payload: LicenseTypePriceUpdate, db: Session = Depends(get_db)):
    """Cambia el precio de TODAS las licencias de un tipo a la vez. La fecha
    de renovación y cualquier otro campo de cada licencia se mantienen
    intactos: solo se toca el precio."""
    licenses = db.scalars(select(License).where(License.tipo.ilike(payload.tipo))).all()
    if not licenses:
        raise HTTPException(status_code=404, detail=f"No hay licencias registradas del tipo '{payload.tipo}'")

    for lic in licenses:
        lic.precio = payload.precio
    db.commit()

    return LicenseTypePriceUpdateResult(tipo=payload.tipo, precio=payload.precio, actualizadas=len(licenses))


# --- CRUD ---


@router.get("", response_model=list[LicenseOut], dependencies=[Depends(require_permission("licencia", "view"))])
def list_licenses(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    tipo: str | None = Query(None),
    proceso: str | None = Query(None),
    search: str | None = Query(None),
):
    return query_licenses(db, company_id, tipo, proceso, search)


@router.post(
    "",
    response_model=LicenseOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("licencia", "create"))],
)
def create_license(
    payload: LicenseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    if not db.get(Company, payload.company_id):
        raise HTTPException(status_code=400, detail="Empresa no válida")

    existing = db.scalar(
        select(License).where(
            License.company_id == payload.company_id,
            License.cuenta == payload.cuenta,
            License.tipo == payload.tipo,
        )
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Ya existe una licencia de ese tipo para esa cuenta en esta empresa"
        )

    license_ = License(**payload.model_dump(), created_by=current_user.id)
    db.add(license_)
    db.commit()
    db.refresh(license_)
    return license_


@router.get("/{license_id}", response_model=LicenseOut, dependencies=[Depends(require_permission("licencia", "view"))])
def get_license(license_id: int, db: Session = Depends(get_db)):
    license_ = db.get(License, license_id)
    if not license_:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    return license_


@router.put(
    "/{license_id}", response_model=LicenseOut, dependencies=[Depends(require_permission("licencia", "edit"))]
)
def update_license(license_id: int, payload: LicenseUpdate, db: Session = Depends(get_db)):
    license_ = db.get(License, license_id)
    if not license_:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")

    data = payload.model_dump(exclude_unset=True)
    if "company_id" in data and not db.get(Company, data["company_id"]):
        raise HTTPException(status_code=400, detail="Empresa no válida")

    for field, value in data.items():
        setattr(license_, field, value)

    db.commit()
    db.refresh(license_)
    return license_


@router.delete(
    "/{license_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("licencia", "delete"))],
)
def delete_license(license_id: int, db: Session = Depends(get_db)):
    license_ = db.get(License, license_id)
    if not license_:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    db.delete(license_)
    db.commit()
