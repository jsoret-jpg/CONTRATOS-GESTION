import io
from decimal import Decimal

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.exports.templates import build_data_workbook, build_template_workbook
from app.imports.monthly_payment_import import EXPECTED_COLUMNS, validate_and_prepare
from app.models.company import Company
from app.models.monthly_payment import MonthlyPayment
from app.models.user import User
from app.schemas.monthly_payment import (
    ImportErrorItem,
    ImportSummary,
    MonthlyPaymentCreate,
    MonthlyPaymentOut,
    MonthlyPaymentSummary,
    MonthlyPaymentUpdate,
)
from app.services.monthly_payment_service import (
    checklist_completo,
    compute_estado,
    compute_porcentaje,
    query_monthly_payments,
)

router = APIRouter(prefix="/monthly-payments", tags=["monthly-payments"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

EXPORT_HEADERS = [
    "empresa",
    "tipo_servicio",
    "anio",
    "mes",
    "monto",
    "solped_registrada",
    "factura_registrada",
    "pagada",
    "porcentaje",
    "estado",
    "observaciones",
]

TEMPLATE_EXAMPLE_ROW = [
    "Oregon Foods",
    "Internet",
    2026,
    1,
    1200.00,
    "SI",
    "NO",
    "NO",
    "Fila de ejemplo, bórrala antes de importar",
]

TEMPLATE_INSTRUCTIONS = [
    "Instrucciones para importar Pagos mensuales",
    "",
    "- empresa: obligatoria (debe coincidir con el nombre o código de una empresa existente).",
    "- tipo_servicio: obligatorio (identifica el registro junto con empresa/año/mes).",
    "- anio y mes: opcionales, si se dejan vacíos se usa el año/mes actual. mes entre 1 y 12.",
    "- monto: opcional, numérico (si se deja vacío se registra como 0).",
    "- solped_registrada, factura_registrada, pagada: SI o NO (checklist de 3 pasos).",
    "- 'pagada' solo puede ser SI si solped_registrada y factura_registrada también son SI; si no, la fila se rechaza.",
    "- La combinación empresa + tipo_servicio + anio + mes es única: si ya existe, se actualiza el registro.",
    "- observaciones: texto libre, opcional.",
    "- porcentaje y estado se calculan automáticamente, no se importan.",
]


def _to_row(p: MonthlyPayment, companies: dict[int, Company]) -> list:
    return [
        companies[p.company_id].name if p.company_id in companies else "",
        p.tipo_servicio,
        p.anio,
        p.mes,
        float(p.monto),
        "SI" if p.solped_registrada else "NO",
        "SI" if p.factura_registrada else "NO",
        "SI" if p.pagada else "NO",
        compute_porcentaje(p),
        compute_estado(p),
        p.observaciones or "",
    ]


def _reject_if_pagada_without_checklist(pagada_solicitada: bool, payment: MonthlyPayment) -> None:
    if pagada_solicitada and not checklist_completo(payment):
        raise HTTPException(
            status_code=400,
            detail="No se puede marcar como pagada sin completar antes SOLPED registrada y factura registrada",
        )


# --- Rutas estáticas primero ---


@router.get("/template", dependencies=[Depends(require_permission("pago_mensual", "import"))])
def download_template():
    content = build_template_workbook(EXPECTED_COLUMNS, TEMPLATE_EXAMPLE_ROW, TEMPLATE_INSTRUCTIONS)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=plantilla_pagos_mensuales.xlsx"},
    )


@router.get("/export", dependencies=[Depends(require_permission("pago_mensual", "export"))])
def export_monthly_payments(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    anio: int | None = Query(None),
    mes: int | None = Query(None),
    tipo_servicio: str | None = Query(None),
    pagada: bool | None = Query(None),
):
    payments = query_monthly_payments(db, company_id, anio, mes, tipo_servicio, pagada)
    companies = {c.id: c for c in db.scalars(select(Company))}

    rows = [_to_row(p, companies) for p in payments]
    content = build_data_workbook(EXPORT_HEADERS, rows)
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=pagos_mensuales_export.xlsx"},
    )


@router.post(
    "/import",
    response_model=ImportSummary,
    dependencies=[Depends(require_permission("pago_mensual", "import"))],
)
async def import_monthly_payments(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
    response_model=MonthlyPaymentSummary,
    dependencies=[Depends(require_permission("pago_mensual", "view"))],
)
def monthly_payment_summary(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    anio: int | None = Query(None),
    mes: int | None = Query(None),
    tipo_servicio: str | None = Query(None),
    pagada: bool | None = Query(None),
):
    payments = query_monthly_payments(db, company_id, anio, mes, tipo_servicio, pagada)
    por_estado: dict[str, int] = {}
    total_pagado = Decimal("0")
    total_pendiente = Decimal("0")
    for p in payments:
        estado = compute_estado(p)
        por_estado[estado] = por_estado.get(estado, 0) + 1
        if p.pagada:
            total_pagado += p.monto
        else:
            total_pendiente += p.monto
    return MonthlyPaymentSummary(
        total=len(payments),
        por_estado=por_estado,
        total_monto_pagado=total_pagado,
        total_monto_pendiente=total_pendiente,
    )


# --- CRUD ---


@router.get(
    "", response_model=list[MonthlyPaymentOut], dependencies=[Depends(require_permission("pago_mensual", "view"))]
)
def list_monthly_payments(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    anio: int | None = Query(None),
    mes: int | None = Query(None),
    tipo_servicio: str | None = Query(None),
    pagada: bool | None = Query(None),
):
    return query_monthly_payments(db, company_id, anio, mes, tipo_servicio, pagada)


@router.post(
    "",
    response_model=MonthlyPaymentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("pago_mensual", "create"))],
)
def create_monthly_payment(
    payload: MonthlyPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.get(Company, payload.company_id):
        raise HTTPException(status_code=400, detail="Empresa no válida")

    existing = db.scalar(
        select(MonthlyPayment).where(
            MonthlyPayment.company_id == payload.company_id,
            MonthlyPayment.tipo_servicio == payload.tipo_servicio,
            MonthlyPayment.anio == payload.anio,
            MonthlyPayment.mes == payload.mes,
        )
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un registro de pago mensual para esa empresa, servicio y periodo",
        )

    payment = MonthlyPayment(**payload.model_dump(exclude={"pagada"}), pagada=False, created_by=current_user.id)
    _reject_if_pagada_without_checklist(payload.pagada, payment)
    payment.pagada = payload.pagada

    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.get(
    "/{payment_id}",
    response_model=MonthlyPaymentOut,
    dependencies=[Depends(require_permission("pago_mensual", "view"))],
)
def get_monthly_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.get(MonthlyPayment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return payment


@router.put(
    "/{payment_id}",
    response_model=MonthlyPaymentOut,
    dependencies=[Depends(require_permission("pago_mensual", "edit"))],
)
def update_monthly_payment(payment_id: int, payload: MonthlyPaymentUpdate, db: Session = Depends(get_db)):
    payment = db.get(MonthlyPayment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    data = payload.model_dump(exclude_unset=True)
    pagada_solicitada = data.pop("pagada", None)

    if "company_id" in data and data["company_id"] is not None and not db.get(Company, data["company_id"]):
        raise HTTPException(status_code=400, detail="Empresa no válida")

    nuevo_company_id = data.get("company_id", payment.company_id)
    nuevo_tipo_servicio = data.get("tipo_servicio", payment.tipo_servicio)
    nuevo_anio = data.get("anio", payment.anio)
    nuevo_mes = data.get("mes", payment.mes)
    if (nuevo_company_id, nuevo_tipo_servicio, nuevo_anio, nuevo_mes) != (
        payment.company_id,
        payment.tipo_servicio,
        payment.anio,
        payment.mes,
    ):
        duplicado = db.scalar(
            select(MonthlyPayment).where(
                MonthlyPayment.id != payment_id,
                MonthlyPayment.company_id == nuevo_company_id,
                MonthlyPayment.tipo_servicio == nuevo_tipo_servicio,
                MonthlyPayment.anio == nuevo_anio,
                MonthlyPayment.mes == nuevo_mes,
            )
        )
        if duplicado:
            raise HTTPException(
                status_code=400,
                detail="Ya existe un registro de pago mensual para esa empresa, servicio y periodo",
            )

    for field, value in data.items():
        setattr(payment, field, value)

    if pagada_solicitada is not None:
        _reject_if_pagada_without_checklist(pagada_solicitada, payment)
        payment.pagada = pagada_solicitada

    # Si algún paso del checklist se desmarca y el registro seguía "pagada",
    # el pago ya no puede considerarse pagado: se revierte automáticamente.
    if payment.pagada and not checklist_completo(payment):
        payment.pagada = False

    db.commit()
    db.refresh(payment)
    return payment


@router.delete(
    "/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("pago_mensual", "delete"))],
)
def delete_monthly_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.get(MonthlyPayment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    db.delete(payment)
    db.commit()
