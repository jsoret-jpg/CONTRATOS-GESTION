from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.contract import Contract
from app.models.invoice import Invoice
from app.models.monthly_payment import MonthlyPayment
from app.models.notification import Notification
from app.models.servicio_producto import ServicioProducto
from app.models.solped import Solped
from app.services.budget_service import compute_budget_figures
from app.utils.date_estado import compute_estado, compute_meses_faltantes

UMBRAL_PRESUPUESTO_POR_AGOTARSE = Decimal("80")


def generate_alerts(db: Session) -> int:
    """Recalcula todas las alertas del sistema. Es idempotente: si una
    condición sigue vigente y ya tenía una notificación (leída o no), no la
    duplica ni le resetea el estado de lectura. Si la condición ya no
    aplica, elimina la notificación. Devuelve cuántas notificaciones nuevas
    se crearon."""

    # target: clave (tipo, tabla, id) -> (modulo, codigo legible, mensaje)
    targets: dict[tuple[str, str, int], tuple[str, str, str]] = {}

    for contract in db.scalars(select(Contract)).all():
        # Las alertas de vencimiento solo aplican a contratos de tipo
        # "Contrato". Un contrato "Libre" (u otro tipo) no genera alerta.
        if (contract.tipo_contrato or "").strip().lower() != "contrato":
            continue

        estado = compute_estado(contract.fecha_fin)
        if estado in ("urgente", "proximo_vencer"):
            meses = compute_meses_faltantes(contract.fecha_fin)
            targets[("contrato_por_vencer", "contracts", contract.id)] = (
                "contrato",
                contract.numero_contrato,
                f"El contrato {contract.numero_contrato} vence en {meses} mes(es)",
            )
        elif estado == "vencido":
            targets[("contrato_vencido", "contracts", contract.id)] = (
                "contrato",
                contract.numero_contrato,
                f"El contrato {contract.numero_contrato} está vencido",
            )

    for invoice in db.scalars(select(Invoice).where(Invoice.estado == "registrada")).all():
        targets[("factura_pendiente", "invoices", invoice.id)] = (
            "factura",
            invoice.numero_factura,
            f"La factura {invoice.numero_factura} está pendiente de pago",
        )

    for solped in db.scalars(select(Solped)).all():
        if solped.estado != "factura_pagada":
            targets[("solped_pendiente", "solpeds", solped.id)] = (
                "solped",
                solped.numero_solped,
                f"La SOLPED {solped.numero_solped} sigue pendiente",
            )
        if solped.estado == "orden_registrada":
            targets[("orden_no_enviada", "solpeds", solped.id)] = (
                "solped",
                solped.numero_solped,
                f"La orden de la SOLPED {solped.numero_solped} aún no se ha enviado",
            )
        if solped.presupuestada and not solped.monto_ejecutado:
            targets[("gasto_pendiente", "solpeds", solped.id)] = (
                "solped",
                solped.numero_solped,
                f"La SOLPED {solped.numero_solped} está presupuestada pero aún no se ejecuta el gasto",
            )

    for payment in db.scalars(select(MonthlyPayment).where(MonthlyPayment.pagada.is_(False))).all():
        targets[("pago_mensual_pendiente", "monthly_payments", payment.id)] = (
            "pago_mensual",
            payment.tipo_servicio,
            f"El pago mensual de '{payment.tipo_servicio}' ({payment.mes}/{payment.anio}) sigue pendiente",
        )

    servicios_productos = {sp.id: sp.nombre for sp in db.scalars(select(ServicioProducto))}
    for budget in db.scalars(select(Budget)).all():
        nombre_servicio = servicios_productos.get(budget.servicio_producto_id, "servicio desconocido")
        codigo_servicio = str(budget.servicio_producto_id)
        figures = compute_budget_figures(db, budget)
        if figures["excedido"]:
            targets[("presupuesto_excedido", "budgets", budget.id)] = (
                "presupuesto",
                codigo_servicio,
                f"El presupuesto de '{nombre_servicio}' ({budget.mes}/{budget.anio}) está excedido",
            )
        elif figures["porcentaje_ejecutado"] >= UMBRAL_PRESUPUESTO_POR_AGOTARSE:
            targets[("presupuesto_por_agotarse", "budgets", budget.id)] = (
                "presupuesto",
                codigo_servicio,
                f"El presupuesto de '{nombre_servicio}' ({budget.mes}/{budget.anio}) está por agotarse "
                f"({figures['porcentaje_ejecutado']:.0f}% ejecutado)",
            )

    existentes = {
        (n.tipo, n.referencia_tabla, n.referencia_id): n for n in db.scalars(select(Notification)).all()
    }

    creadas = 0
    for key, (modulo, codigo, mensaje) in targets.items():
        if key in existentes:
            continue
        tipo, tabla, referencia_id = key
        db.add(
            Notification(
                tipo=tipo,
                modulo=modulo,
                referencia_tabla=tabla,
                referencia_id=referencia_id,
                referencia_codigo=codigo,
                mensaje=mensaje,
            )
        )
        creadas += 1

    for key, notification in existentes.items():
        if key not in targets:
            db.delete(notification)

    db.commit()
    return creadas
