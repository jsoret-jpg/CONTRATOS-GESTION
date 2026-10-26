from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.budget import Budget, BudgetMovement
from models.invoice import Invoice
from models.servicio_producto import ServicioProducto
from models.solped import Solped


def query_budgets(
    db: Session,
    company_id: int | None = None,
    servicio_producto_id: int | None = None,
    anio: int | None = None,
    mes: int | None = None,
) -> list[Budget]:
    stmt = select(Budget)
    if company_id:
        stmt = stmt.where(Budget.company_id == company_id)
    if servicio_producto_id:
        stmt = stmt.where(Budget.servicio_producto_id == servicio_producto_id)
    if anio:
        stmt = stmt.where(Budget.anio == anio)
    if mes:
        stmt = stmt.where(Budget.mes == mes)
    stmt = stmt.order_by(Budget.anio.desc(), Budget.mes.desc())
    return list(db.scalars(stmt).all())


def compute_budget_figures(db: Session, budget: Budget) -> dict:
    movements = db.scalars(select(BudgetMovement).where(BudgetMovement.budget_id == budget.id)).all()
    ejecutado = sum((m.monto for m in movements if m.tipo == "ejecucion"), Decimal("0"))
    compensado = sum((m.monto for m in movements if m.tipo == "compensacion"), Decimal("0"))
    presupuesto_asignado = budget.monto_mensual + compensado
    disponible = presupuesto_asignado - ejecutado
    porcentaje_ejecutado = (
        (ejecutado / presupuesto_asignado * 100) if presupuesto_asignado > 0 else Decimal("0")
    )
    excedido = ejecutado > presupuesto_asignado
    return {
        "ejecutado": ejecutado,
        "compensado": compensado,
        "presupuesto_asignado": presupuesto_asignado,
        "disponible": disponible,
        "porcentaje_ejecutado": porcentaje_ejecutado,
        "excedido": excedido,
    }


def sync_solped_execution_from_invoices(db: Session, solped: Solped) -> str | None:
    """Trazabilidad SOLPED -> Factura -> Pago -> Ejecución: el monto
    ejecutado de la SOLPED se calcula automáticamente como la suma de sus
    facturas en estado 'pagada' (no se registra manualmente dos veces). Si
    una factura deja de estar pagada o se elimina, esto se recalcula solo.
    Devuelve la alerta de presupuesto, si corresponde (nunca bloquea)."""
    facturas_pagadas = db.scalars(
        select(Invoice).where(Invoice.solped_id == solped.id, Invoice.estado == "pagada")
    ).all()

    if facturas_pagadas:
        solped.monto_ejecutado = sum((f.monto_factura for f in facturas_pagadas), Decimal("0"))
        fechas_pago = [f.fecha_pago for f in facturas_pagadas if f.fecha_pago]
        solped.fecha_ejecucion = max(fechas_pago) if fechas_pago else solped.fecha_ejecucion
    else:
        solped.monto_ejecutado = None

    db.commit()
    db.refresh(solped)

    return register_solped_execution(db, solped)


def register_solped_execution(db: Session, solped: Solped) -> str | None:
    """Si la SOLPED tiene 'servicio_producto_id' y 'monto_ejecutado', registra
    (o actualiza) el movimiento de ejecución presupuestal correspondiente,
    relacionando ambos registros por ID (nunca por texto). Nunca bloquea el
    guardado de la SOLPED: si no hay presupuesto para ese servicio/periodo,
    o si se excede, devuelve un mensaje de alerta para que el frontend lo
    muestre."""

    existing_movement = db.scalar(
        select(BudgetMovement).where(BudgetMovement.solped_id == solped.id, BudgetMovement.tipo == "ejecucion")
    )

    if not solped.servicio_producto_id or not solped.monto_ejecutado or solped.monto_ejecutado <= 0:
        if existing_movement:
            db.delete(existing_movement)
            db.commit()
        return None

    periodo_fecha = solped.fecha_ejecucion or solped.fecha_solped
    budget = db.scalar(
        select(Budget).where(
            Budget.company_id == solped.company_id,
            Budget.servicio_producto_id == solped.servicio_producto_id,
            Budget.anio == periodo_fecha.year,
            Budget.mes == periodo_fecha.month,
        )
    )

    servicio_producto = db.get(ServicioProducto, solped.servicio_producto_id)
    nombre_servicio = servicio_producto.nombre if servicio_producto else "servicio desconocido"

    if not budget:
        if existing_movement:
            db.delete(existing_movement)
            db.commit()
        return (
            f"No existe presupuesto registrado para '{nombre_servicio}' en "
            f"{periodo_fecha.month}/{periodo_fecha.year}; la SOLPED se guardó pero no afectó ningún presupuesto"
        )

    if existing_movement:
        existing_movement.budget_id = budget.id
        existing_movement.monto = solped.monto_ejecutado
        existing_movement.fecha = periodo_fecha
    else:
        db.add(
            BudgetMovement(
                budget_id=budget.id,
                tipo="ejecucion",
                solped_id=solped.id,
                monto=solped.monto_ejecutado,
                fecha=periodo_fecha,
                usuario_id=solped.created_by,
            )
        )
    db.commit()

    figures = compute_budget_figures(db, budget)
    if figures["excedido"]:
        return (
            f"Presupuesto excedido para '{nombre_servicio}' en {periodo_fecha.month}/{periodo_fecha.year}: "
            f"ejecutado {figures['ejecutado']} de {figures['presupuesto_asignado']} asignado"
        )
    return None


def get_annual_budget(db: Session, company_id: int, servicio_producto_id: int, anio: int) -> dict | None:
    """Agrega los presupuestos mensuales (registros individuales, ya
    probados) de un año+empresa+servicio en una sola vista con los 12
    meses, su total anual, ejecutado y disponible — sin cambiar cómo se
    guardan los datos."""
    servicio_producto = db.get(ServicioProducto, servicio_producto_id)
    if not servicio_producto:
        return None

    budgets_by_mes = {
        b.mes: b
        for b in db.scalars(
            select(Budget).where(
                Budget.company_id == company_id,
                Budget.servicio_producto_id == servicio_producto_id,
                Budget.anio == anio,
            )
        )
    }
    if not budgets_by_mes:
        return None

    meses = []
    total_anual = Decimal("0")
    total_ejecutado = Decimal("0")
    total_disponible = Decimal("0")
    for mes in range(1, 13):
        budget = budgets_by_mes.get(mes)
        if budget:
            figures = compute_budget_figures(db, budget)
            meses.append(
                {
                    "mes": mes,
                    "budget_id": budget.id,
                    "monto_mensual": budget.monto_mensual,
                    "ejecutado": figures["ejecutado"],
                    "disponible": figures["disponible"],
                    "porcentaje_ejecutado": figures["porcentaje_ejecutado"],
                    "excedido": figures["excedido"],
                }
            )
            total_anual += budget.monto_mensual
            total_ejecutado += figures["ejecutado"]
            total_disponible += figures["disponible"]
        else:
            meses.append(
                {
                    "mes": mes,
                    "budget_id": None,
                    "monto_mensual": Decimal("0"),
                    "ejecutado": Decimal("0"),
                    "disponible": Decimal("0"),
                    "porcentaje_ejecutado": Decimal("0"),
                    "excedido": False,
                }
            )

    porcentaje_anual = (total_ejecutado / total_anual * 100) if total_anual > 0 else Decimal("0")

    return {
        "company_id": company_id,
        "servicio_producto_id": servicio_producto_id,
        "servicio_producto_nombre": servicio_producto.nombre,
        "anio": anio,
        "meses": meses,
        "total_anual": total_anual,
        "total_ejecutado": total_ejecutado,
        "total_disponible": total_disponible,
        "porcentaje_ejecucion_anual": porcentaje_anual,
    }


def list_annual_budgets(
    db: Session, company_id: int | None = None, servicio_producto_id: int | None = None, anio: int | None = None
) -> list[dict]:
    """Lista todas las combinaciones (empresa, servicio/producto, año) que
    tengan al menos un mes presupuestado, cada una como una fila anual."""
    stmt = select(Budget.company_id, Budget.servicio_producto_id, Budget.anio).distinct()
    if company_id:
        stmt = stmt.where(Budget.company_id == company_id)
    if servicio_producto_id:
        stmt = stmt.where(Budget.servicio_producto_id == servicio_producto_id)
    if anio:
        stmt = stmt.where(Budget.anio == anio)

    combos = db.execute(stmt).all()
    resultado = []
    for company_id_, servicio_producto_id_, anio_ in combos:
        anual = get_annual_budget(db, company_id_, servicio_producto_id_, anio_)
        if anual:
            resultado.append(anual)
    resultado.sort(key=lambda a: (-a["anio"], a["servicio_producto_nombre"]))
    return resultado


def upsert_annual_budget(
    db: Session, company_id: int, servicio_producto_id: int, anio: int, montos: dict[int, Decimal]
) -> dict | None:
    """Crea o actualiza, en un solo llamado, cualquier subconjunto de los 12
    meses de un presupuesto anual. No toca los meses que no vengan en
    `montos`."""
    for mes, monto in montos.items():
        budget = db.scalar(
            select(Budget).where(
                Budget.company_id == company_id,
                Budget.servicio_producto_id == servicio_producto_id,
                Budget.anio == anio,
                Budget.mes == mes,
            )
        )
        if budget:
            budget.monto_mensual = monto
        else:
            db.add(
                Budget(
                    company_id=company_id,
                    servicio_producto_id=servicio_producto_id,
                    anio=anio,
                    mes=mes,
                    monto_mensual=monto,
                )
            )
    db.commit()
    return get_annual_budget(db, company_id, servicio_producto_id, anio)
