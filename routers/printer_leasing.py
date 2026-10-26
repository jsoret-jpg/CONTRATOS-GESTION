import io
from decimal import Decimal

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_permission
from exports.templates import build_data_workbook, build_template_workbook
from imports.cost_center_import import EXPECTED_COLUMNS as COST_CENTER_COLUMNS
from imports.cost_center_import import validate_and_prepare as validate_cost_centers
from imports.printer_consumption_import import EXPECTED_COLUMNS as CONSUMPTION_COLUMNS
from imports.printer_consumption_import import validate_and_prepare as validate_consumption
from models.printer_leasing import (
    CostCenter,
    PecuariaCompany,
    PrinterConsumption,
    PrinterConsumptionCompany,
    PrinterInvoice,
)
from utils.ceco_resolver import resolve_company_name_from_ceco
from schemas.printer_leasing import (
    AllocationSummary,
    CostCenterCreate,
    CostCenterOut,
    CostCenterUpdate,
    ImportErrorItem,
    ImportSummary,
    PecuariaCompanyOut,
    PrinterAllocationOut,
    PrinterConsumptionCompanyOut,
    PrinterConsumptionCreate,
    PrinterConsumptionOut,
    PrinterConsumptionUpdate,
    PrinterInvoiceCreate,
    PrinterInvoiceOut,
    PrinterInvoiceUpdate,
)
from services.printer_leasing_service import (
    compute_allocation,
    query_allocations,
    query_consumption,
    query_cost_centers,
    query_invoices,
)

router = APIRouter(prefix="/printer-leasing", tags=["printer-leasing"])
XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


# --- Catálogos (solo lectura, sembrados por migración) ---


@router.get(
    "/pecuaria-companies",
    response_model=list[PecuariaCompanyOut],
    dependencies=[Depends(require_permission("leasing_impresora", "view"))],
)
def list_pecuaria_companies(db: Session = Depends(get_db)):
    return db.scalars(select(PecuariaCompany).order_by(PecuariaCompany.name)).all()


@router.get(
    "/consumption-companies",
    response_model=list[PrinterConsumptionCompanyOut],
    dependencies=[Depends(require_permission("leasing_impresora", "view"))],
)
def list_consumption_companies(db: Session = Depends(get_db)):
    return db.scalars(select(PrinterConsumptionCompany).order_by(PrinterConsumptionCompany.name)).all()


# --- Centros de costo ---


@router.get("/cost-centers/template", dependencies=[Depends(require_permission("leasing_impresora", "import"))])
def download_cost_center_template():
    content = build_template_workbook(
        COST_CENTER_COLUMNS,
        ["OF-001-Chincha", "Producción"],
        [
            "Instrucciones para importar centros de costo",
            "",
            "- nombre: el CECO. Único, obligatorio.",
            "- La empresa se identifica automáticamente por los primeros caracteres del CECO, no se ingresa a mano:",
            "    OF -> Oregon Foods",
            "    VA -> Valora",
            "    PG -> Protein Group",
            "    MP -> MP San Antonio",
            "    TA -> Tecnica Avicola",
            "  Ejemplos: 'OF-001-123', 'OF123456' -> Oregon Foods. 'VA-002-456' -> Valora.",
            "- proceso: opcional, texto libre.",
            "- Si el nombre (CECO) ya existe, se actualiza el registro (no se duplica).",
        ],
    )
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=plantilla_centros_costo.xlsx"},
    )


@router.post(
    "/cost-centers/import",
    response_model=ImportSummary,
    dependencies=[Depends(require_permission("leasing_impresora", "import"))],
)
async def import_cost_centers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx o .xls)")
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents), sheet_name=0, dtype=object)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {exc}") from exc
    df.columns = [str(c).strip().lower() for c in df.columns]
    try:
        to_create, to_update, errors = validate_cost_centers(df, db)
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
    "/cost-centers",
    response_model=list[CostCenterOut],
    dependencies=[Depends(require_permission("leasing_impresora", "view"))],
)
def list_cost_centers(
    db: Session = Depends(get_db),
    pecuaria_company_id: int | None = Query(None),
    search: str | None = Query(None),
):
    return query_cost_centers(db, pecuaria_company_id, search)


@router.post(
    "/cost-centers",
    response_model=CostCenterOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("leasing_impresora", "create"))],
)
def create_cost_center(payload: CostCenterCreate, db: Session = Depends(get_db)):
    if db.scalar(select(CostCenter).where(CostCenter.name == payload.name)):
        raise HTTPException(status_code=400, detail="Ya existe un centro de costo con ese nombre")

    empresa_nombre = resolve_company_name_from_ceco(payload.name)
    if not empresa_nombre:
        prefijo = payload.name.strip().upper()[:2]
        raise HTTPException(
            status_code=400,
            detail=f"Prefijo de CECO no reconocido: '{prefijo}' (usa OF, VA, PG, MP o TA al inicio del CECO)",
        )
    pecuaria = db.scalar(select(PecuariaCompany).where(PecuariaCompany.name == empresa_nombre))
    if not pecuaria:
        raise HTTPException(status_code=400, detail=f"Empresa '{empresa_nombre}' no está sembrada en el sistema")

    cost_center = CostCenter(
        name=payload.name, proceso=payload.proceso, is_active=payload.is_active, pecuaria_company_id=pecuaria.id
    )
    db.add(cost_center)
    db.commit()
    db.refresh(cost_center)
    return cost_center


@router.put(
    "/cost-centers/{cost_center_id}",
    response_model=CostCenterOut,
    dependencies=[Depends(require_permission("leasing_impresora", "edit"))],
)
def update_cost_center(cost_center_id: int, payload: CostCenterUpdate, db: Session = Depends(get_db)):
    cost_center = db.get(CostCenter, cost_center_id)
    if not cost_center:
        raise HTTPException(status_code=404, detail="Centro de costo no encontrado")
    data = payload.model_dump(exclude_unset=True)

    if "name" in data and data["name"]:
        empresa_nombre = resolve_company_name_from_ceco(data["name"])
        if not empresa_nombre:
            prefijo = data["name"].strip().upper()[:2]
            raise HTTPException(
                status_code=400,
                detail=f"Prefijo de CECO no reconocido: '{prefijo}' (usa OF, VA, PG, MP o TA al inicio del CECO)",
            )
        pecuaria = db.scalar(select(PecuariaCompany).where(PecuariaCompany.name == empresa_nombre))
        if not pecuaria:
            raise HTTPException(status_code=400, detail=f"Empresa '{empresa_nombre}' no está sembrada en el sistema")
        data["pecuaria_company_id"] = pecuaria.id

    for field, value in data.items():
        setattr(cost_center, field, value)
    db.commit()
    db.refresh(cost_center)
    return cost_center


@router.delete(
    "/cost-centers/{cost_center_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("leasing_impresora", "delete"))],
)
def delete_cost_center(cost_center_id: int, db: Session = Depends(get_db)):
    cost_center = db.get(CostCenter, cost_center_id)
    if not cost_center:
        raise HTTPException(status_code=404, detail="Centro de costo no encontrado")
    db.delete(cost_center)
    db.commit()


# --- Consumo mensual ---


@router.get("/consumption/template", dependencies=[Depends(require_permission("leasing_impresora", "import"))])
def download_consumption_template():
    content = build_template_workbook(
        CONSUMPTION_COLUMNS,
        ["Planta Chincha", "Juan Perez", "Producción", 2026, 1, 350],
        [
            "Instrucciones para importar el reporte mensual de consumo",
            "",
            "- centro_costo: debe existir previamente (regístralo o impórtalo antes).",
            "- usuario: obligatorio.",
            "- proceso: opcional (si no se indica, se usa el del centro de costo).",
            "- anio y mes: numéricos, mes entre 1 y 12.",
            "- consumo: obligatorio, numérico (páginas u otra unidad de medida).",
            "- La combinación centro_costo + usuario + anio + mes es única: si ya existe, se actualiza.",
        ],
    )
    return StreamingResponse(
        io.BytesIO(content),
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=plantilla_consumo_impresoras.xlsx"},
    )


@router.post(
    "/consumption/import",
    response_model=ImportSummary,
    dependencies=[Depends(require_permission("leasing_impresora", "import"))],
)
async def import_consumption(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx o .xls)")
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents), sheet_name=0, dtype=object)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {exc}") from exc
    df.columns = [str(c).strip().lower() for c in df.columns]
    try:
        to_create, to_update, errors = validate_consumption(df, db)
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
    "/consumption",
    response_model=list[PrinterConsumptionOut],
    dependencies=[Depends(require_permission("leasing_impresora", "view"))],
)
def list_consumption(
    db: Session = Depends(get_db),
    anio: int | None = Query(None),
    mes: int | None = Query(None),
    usuario: str | None = Query(None),
    pecuaria_company_id: int | None = Query(None),
    proceso: str | None = Query(None),
    cost_center_id: int | None = Query(None),
):
    return query_consumption(db, anio, mes, usuario, pecuaria_company_id, proceso, cost_center_id)


@router.post(
    "/consumption",
    response_model=PrinterConsumptionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("leasing_impresora", "create"))],
)
def create_consumption(payload: PrinterConsumptionCreate, db: Session = Depends(get_db)):
    if not db.get(CostCenter, payload.cost_center_id):
        raise HTTPException(status_code=400, detail="Centro de costo no válido")
    existing = db.scalar(
        select(PrinterConsumption).where(
            PrinterConsumption.cost_center_id == payload.cost_center_id,
            PrinterConsumption.usuario == payload.usuario,
            PrinterConsumption.anio == payload.anio,
            PrinterConsumption.mes == payload.mes,
        )
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Ya existe consumo registrado para ese usuario, centro de costo y periodo"
        )
    item = PrinterConsumption(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put(
    "/consumption/{consumption_id}",
    response_model=PrinterConsumptionOut,
    dependencies=[Depends(require_permission("leasing_impresora", "edit"))],
)
def update_consumption(consumption_id: int, payload: PrinterConsumptionUpdate, db: Session = Depends(get_db)):
    item = db.get(PrinterConsumption, consumption_id)
    if not item:
        raise HTTPException(status_code=404, detail="Registro de consumo no encontrado")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete(
    "/consumption/{consumption_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("leasing_impresora", "delete"))],
)
def delete_consumption(consumption_id: int, db: Session = Depends(get_db)):
    item = db.get(PrinterConsumption, consumption_id)
    if not item:
        raise HTTPException(status_code=404, detail="Registro de consumo no encontrado")
    db.delete(item)
    db.commit()


# --- Facturas mensuales y prorrateo ---


@router.get(
    "/invoices",
    response_model=list[PrinterInvoiceOut],
    dependencies=[Depends(require_permission("leasing_impresora", "view"))],
)
def list_invoices(
    db: Session = Depends(get_db),
    printer_company_id: int | None = Query(None),
    anio: int | None = Query(None),
    mes: int | None = Query(None),
):
    return query_invoices(db, printer_company_id, anio, mes)


@router.post(
    "/invoices",
    response_model=PrinterInvoiceOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("leasing_impresora", "create"))],
)
def create_invoice(payload: PrinterInvoiceCreate, db: Session = Depends(get_db)):
    if not db.get(PrinterConsumptionCompany, payload.printer_company_id):
        raise HTTPException(status_code=400, detail="Empresa de consumo no válida")
    existing = db.scalar(
        select(PrinterInvoice).where(
            PrinterInvoice.printer_company_id == payload.printer_company_id,
            PrinterInvoice.anio == payload.anio,
            PrinterInvoice.mes == payload.mes,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una factura para esa empresa y periodo")
    invoice = PrinterInvoice(**payload.model_dump())
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.put(
    "/invoices/{invoice_id}",
    response_model=PrinterInvoiceOut,
    dependencies=[Depends(require_permission("leasing_impresora", "edit"))],
)
def update_invoice(invoice_id: int, payload: PrinterInvoiceUpdate, db: Session = Depends(get_db)):
    invoice = db.get(PrinterInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(invoice, field, value)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.delete(
    "/invoices/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("leasing_impresora", "delete"))],
)
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.get(PrinterInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    db.delete(invoice)
    db.commit()


@router.post(
    "/invoices/{invoice_id}/calcular-prorrateo",
    response_model=list[PrinterAllocationOut],
    dependencies=[Depends(require_permission("leasing_impresora", "edit"))],
)
def calculate_allocation(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.get(PrinterInvoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    try:
        return compute_allocation(db, invoice)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# --- Prorrateo: consulta histórica ---


@router.get(
    "/allocations",
    response_model=list[PrinterAllocationOut],
    dependencies=[Depends(require_permission("leasing_impresora", "view"))],
)
def list_allocations(
    db: Session = Depends(get_db),
    printer_invoice_id: int | None = Query(None),
    anio: int | None = Query(None),
    mes: int | None = Query(None),
    usuario: str | None = Query(None),
    pecuaria_company_id: int | None = Query(None),
    proceso: str | None = Query(None),
):
    return query_allocations(db, printer_invoice_id, anio, mes, usuario, pecuaria_company_id, proceso)


@router.get(
    "/allocations/summary",
    response_model=AllocationSummary,
    dependencies=[Depends(require_permission("leasing_impresora", "view"))],
)
def allocation_summary(
    db: Session = Depends(get_db),
    anio: int | None = Query(None),
    mes: int | None = Query(None),
    pecuaria_company_id: int | None = Query(None),
):
    allocations = query_allocations(db, anio=anio, mes=mes, pecuaria_company_id=pecuaria_company_id)
    cost_centers = {cc.id: cc for cc in db.scalars(select(CostCenter))}
    pecuarias = {p.id: p for p in db.scalars(select(PecuariaCompany))}

    total = Decimal("0")
    por_pecuaria: dict[str, Decimal] = {}
    por_proceso: dict[str, Decimal] = {}
    por_usuario: dict[str, Decimal] = {}

    for allocation in allocations:
        total += allocation.monto_a_pagar

        cost_center = cost_centers.get(allocation.cost_center_id)
        pecuaria_name = "Sin asignar"
        if cost_center and cost_center.pecuaria_company_id in pecuarias:
            pecuaria_name = pecuarias[cost_center.pecuaria_company_id].name
        por_pecuaria[pecuaria_name] = por_pecuaria.get(pecuaria_name, Decimal("0")) + allocation.monto_a_pagar

        proceso_name = allocation.proceso or "Sin proceso"
        por_proceso[proceso_name] = por_proceso.get(proceso_name, Decimal("0")) + allocation.monto_a_pagar

        por_usuario[allocation.usuario] = por_usuario.get(allocation.usuario, Decimal("0")) + allocation.monto_a_pagar

    return AllocationSummary(
        total_monto=total, por_pecuaria=por_pecuaria, por_proceso=por_proceso, por_usuario=por_usuario
    )
