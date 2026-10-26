from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from models.printer_leasing import (
    CostCenter,
    PecuariaCompany,
    PrinterAllocation,
    PrinterConsumption,
    PrinterConsumptionCompany,
    PrinterInvoice,
)

# Cada factura solo cubre el consumo de las empresas que le corresponden,
# identificadas mediante el prefijo del CECO. No se reparte contra todo el
# consumo del periodo, solo contra el de su propio grupo de empresas.
INVOICE_COVERAGE: dict[str, set[str]] = {
    "Oregon Foods": {"Oregon Foods", "Valora"},
    "Tecnica Avicola": {"Protein Group", "MP San Antonio", "Tecnica Avicola"},
}


def query_cost_centers(
    db: Session, pecuaria_company_id: int | None = None, search: str | None = None
) -> list[CostCenter]:
    stmt = select(CostCenter)
    if pecuaria_company_id:
        stmt = stmt.where(CostCenter.pecuaria_company_id == pecuaria_company_id)
    if search:
        stmt = stmt.where(CostCenter.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(CostCenter.name)
    return list(db.scalars(stmt).all())


def query_consumption(
    db: Session,
    anio: int | None = None,
    mes: int | None = None,
    usuario: str | None = None,
    pecuaria_company_id: int | None = None,
    proceso: str | None = None,
    cost_center_id: int | None = None,
) -> list[PrinterConsumption]:
    stmt = select(PrinterConsumption)
    if anio:
        stmt = stmt.where(PrinterConsumption.anio == anio)
    if mes:
        stmt = stmt.where(PrinterConsumption.mes == mes)
    if usuario:
        stmt = stmt.where(PrinterConsumption.usuario.ilike(f"%{usuario}%"))
    if proceso:
        stmt = stmt.where(PrinterConsumption.proceso.ilike(proceso))
    if cost_center_id:
        stmt = stmt.where(PrinterConsumption.cost_center_id == cost_center_id)
    if pecuaria_company_id:
        stmt = stmt.join(CostCenter, CostCenter.id == PrinterConsumption.cost_center_id).where(
            CostCenter.pecuaria_company_id == pecuaria_company_id
        )
    stmt = stmt.order_by(PrinterConsumption.anio.desc(), PrinterConsumption.mes.desc())
    return list(db.scalars(stmt).all())


def query_invoices(
    db: Session,
    printer_company_id: int | None = None,
    anio: int | None = None,
    mes: int | None = None,
) -> list[PrinterInvoice]:
    stmt = select(PrinterInvoice)
    if printer_company_id:
        stmt = stmt.where(PrinterInvoice.printer_company_id == printer_company_id)
    if anio:
        stmt = stmt.where(PrinterInvoice.anio == anio)
    if mes:
        stmt = stmt.where(PrinterInvoice.mes == mes)
    stmt = stmt.order_by(PrinterInvoice.anio.desc(), PrinterInvoice.mes.desc())
    return list(db.scalars(stmt).all())


def compute_allocation(db: Session, invoice: PrinterInvoice) -> list[PrinterAllocation]:
    """Calcula y persiste el prorrateo de una factura según el consumo de las
    empresas que realmente le corresponden (identificadas por el prefijo del
    CECO de cada centro de costo), no contra todo el consumo del periodo.
    Si ya existía un prorrateo previo para esta factura, se reemplaza por
    completo (permite recalcular tras corregir el consumo)."""
    printer_company = db.get(PrinterConsumptionCompany, invoice.printer_company_id)
    coverage = INVOICE_COVERAGE.get(printer_company.name) if printer_company else None

    stmt = select(PrinterConsumption).where(
        PrinterConsumption.anio == invoice.anio, PrinterConsumption.mes == invoice.mes
    )
    if coverage:
        stmt = (
            stmt.join(CostCenter, CostCenter.id == PrinterConsumption.cost_center_id)
            .join(PecuariaCompany, PecuariaCompany.id == CostCenter.pecuaria_company_id)
            .where(PecuariaCompany.name.in_(coverage))
        )

    consumption_rows = list(db.scalars(stmt).all())

    total_consumo = sum((row.consumo for row in consumption_rows), Decimal("0"))
    if total_consumo <= 0:
        cobertura_texto = f" para {', '.join(sorted(coverage))}" if coverage else ""
        raise ValueError(
            f"No hay consumo registrado{cobertura_texto} en el periodo {invoice.mes}/{invoice.anio}; "
            "sube el reporte de consumo antes de calcular el prorrateo"
        )

    db.execute(delete(PrinterAllocation).where(PrinterAllocation.printer_invoice_id == invoice.id))

    allocations = []
    for row in consumption_rows:
        porcentaje = (row.consumo / total_consumo) * Decimal("100")
        monto = (row.consumo / total_consumo) * invoice.monto_sin_igv
        allocation = PrinterAllocation(
            printer_invoice_id=invoice.id,
            cost_center_id=row.cost_center_id,
            usuario=row.usuario,
            proceso=row.proceso,
            anio=row.anio,
            mes=row.mes,
            consumo=row.consumo,
            porcentaje_participacion=porcentaje,
            monto_a_pagar=monto,
        )
        db.add(allocation)
        allocations.append(allocation)

    db.commit()
    for allocation in allocations:
        db.refresh(allocation)
    return allocations


def query_allocations(
    db: Session,
    printer_invoice_id: int | None = None,
    anio: int | None = None,
    mes: int | None = None,
    usuario: str | None = None,
    pecuaria_company_id: int | None = None,
    proceso: str | None = None,
) -> list[PrinterAllocation]:
    stmt = select(PrinterAllocation)
    if printer_invoice_id:
        stmt = stmt.where(PrinterAllocation.printer_invoice_id == printer_invoice_id)
    if anio:
        stmt = stmt.where(PrinterAllocation.anio == anio)
    if mes:
        stmt = stmt.where(PrinterAllocation.mes == mes)
    if usuario:
        stmt = stmt.where(PrinterAllocation.usuario.ilike(f"%{usuario}%"))
    if proceso:
        stmt = stmt.where(PrinterAllocation.proceso.ilike(proceso))
    if pecuaria_company_id:
        stmt = stmt.join(CostCenter, CostCenter.id == PrinterAllocation.cost_center_id).where(
            CostCenter.pecuaria_company_id == pecuaria_company_id
        )
    stmt = stmt.order_by(
        PrinterAllocation.anio.desc(), PrinterAllocation.mes.desc(), PrinterAllocation.monto_a_pagar.desc()
    )
    return list(db.scalars(stmt).all())
