from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.company import Company
from app.models.contract import Contract
from app.models.invoice import Invoice
from app.models.monthly_payment import MonthlyPayment
from app.models.provider import Provider
from app.models.solped import Solped
from app.services.budget_service import compute_budget_figures
from app.services.contract_service import compute_contract_estado


def build_summary(db: Session, anio: int | None = None) -> dict:
    anio = anio or date.today().year

    solpeds = list(db.scalars(select(Solped)).all())
    solpeds_por_estado: dict[str, int] = {}
    for solped in solpeds:
        solpeds_por_estado[solped.estado] = solpeds_por_estado.get(solped.estado, 0) + 1
    solpeds_pendientes = sum(c for estado, c in solpeds_por_estado.items() if estado != "factura_pagada")

    contracts = list(db.scalars(select(Contract)).all())
    contratos_por_vencer = 0
    contratos_vencidos = 0
    for contract in contracts:
        estado = compute_contract_estado(contract.fecha_fin, contract.tipo_contrato)
        if estado in ("urgente", "proximo_vencer"):
            contratos_por_vencer += 1
        elif estado == "vencido":
            contratos_vencidos += 1

    invoices = list(db.scalars(select(Invoice)).all())
    facturas_por_estado: dict[str, int] = {}
    for invoice in invoices:
        facturas_por_estado[invoice.estado] = facturas_por_estado.get(invoice.estado, 0) + 1
    facturas_pendientes = facturas_por_estado.get("registrada", 0)

    monthly_payments = list(db.scalars(select(MonthlyPayment)).all())
    gastos_mensuales_pendientes = sum(1 for p in monthly_payments if not p.pagada)

    budgets = list(db.scalars(select(Budget)).all())
    presupuesto_ejecutado = Decimal("0")
    presupuesto_disponible = Decimal("0")
    presupuesto_excedido_count = 0
    ejecucion_por_mes: dict[int, Decimal] = {m: Decimal("0") for m in range(1, 13)}
    for budget in budgets:
        figures = compute_budget_figures(db, budget)
        presupuesto_ejecutado += figures["ejecutado"]
        presupuesto_disponible += figures["disponible"]
        if figures["excedido"]:
            presupuesto_excedido_count += 1
        if budget.anio == anio:
            ejecucion_por_mes[budget.mes] += figures["ejecutado"]

    companies = {c.id: c.name for c in db.scalars(select(Company))}
    providers = {p.id: p.name for p in db.scalars(select(Provider))}
    solpeds_by_id = {s.id: s for s in solpeds}

    gastos_por_empresa: dict[str, Decimal] = {}
    gastos_por_proveedor: dict[str, Decimal] = {}
    for invoice in invoices:
        solped = solpeds_by_id.get(invoice.solped_id)
        if not solped:
            continue
        company_name = companies.get(solped.company_id, "Sin empresa")
        gastos_por_empresa[company_name] = gastos_por_empresa.get(company_name, Decimal("0")) + invoice.monto_factura

        provider_name = providers.get(solped.provider_id, "Sin proveedor") if solped.provider_id else "Sin proveedor"
        gastos_por_proveedor[provider_name] = (
            gastos_por_proveedor.get(provider_name, Decimal("0")) + invoice.monto_factura
        )

    return {
        "solpeds_total": len(solpeds),
        "solpeds_pendientes": solpeds_pendientes,
        "solpeds_por_estado": solpeds_por_estado,
        "contratos_total": len(contracts),
        "contratos_por_vencer": contratos_por_vencer,
        "contratos_vencidos": contratos_vencidos,
        "facturas_total": len(invoices),
        "facturas_pendientes": facturas_pendientes,
        "facturas_por_estado": facturas_por_estado,
        "gastos_mensuales_pendientes": gastos_mensuales_pendientes,
        "presupuesto_ejecutado": presupuesto_ejecutado,
        "presupuesto_disponible": presupuesto_disponible,
        "presupuesto_excedido_count": presupuesto_excedido_count,
        "gastos_por_empresa": gastos_por_empresa,
        "gastos_por_proveedor": gastos_por_proveedor,
        "ejecucion_presupuestal_mensual": [
            {"mes": m, "ejecutado": ejecucion_por_mes[m]} for m in range(1, 13)
        ],
    }


def query_global_invoices(
    db: Session, estado: str | None = None, company_id: int | None = None
) -> list[dict]:
    """Vista de solo lectura de todas las facturas del sistema (sin importar
    a qué SOLPED pertenezcan), usada por el Panel y por el indicador
    'Facturas pendientes' / 'Facturas por estado'."""
    stmt = select(Invoice, Solped.numero_solped, Solped.company_id).join(
        Solped, Solped.id == Invoice.solped_id
    )
    if estado:
        stmt = stmt.where(Invoice.estado == estado)
    if company_id:
        stmt = stmt.where(Solped.company_id == company_id)
    stmt = stmt.order_by(Invoice.fecha_factura.desc())

    rows = db.execute(stmt).all()
    return [
        {
            "id": invoice.id,
            "solped_id": invoice.solped_id,
            "numero_solped": numero_solped,
            "company_id": company_id_,
            "numero_factura": invoice.numero_factura,
            "fecha_factura": invoice.fecha_factura,
            "monto_factura": invoice.monto_factura,
            "moneda": invoice.moneda,
            "estado": invoice.estado,
            "fecha_pago": invoice.fecha_pago,
        }
        for invoice, numero_solped, company_id_ in rows
    ]
