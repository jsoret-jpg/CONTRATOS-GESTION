from datetime import date
from decimal import Decimal
from uuid import uuid4

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from imports.common import clean_str, normalize_match_key, parse_bool_flexible, parse_date_flexible, parse_decimal_flexible
from models.company import Company
from models.provider import Provider
from models.solped import Solped

EXPECTED_COLUMNS = [
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
    "fecha_ejecucion",
    "observaciones",
]

TIPOS_VALIDOS = {"producto", "servicio"}
MONEDAS_VALIDAS = {"PEN", "USD"}
ESTADOS_VALIDOS = {
    "aprobado_nivel_1",
    "aprobado_nivel_2",
    "aprobado_nivel_3",
    "aprobado_nivel_4",
    "orden_registrada",
    "orden_enviada",
    "factura_registrada",
    "factura_pagada",
}

# Valores por defecto cuando la celda viene vacía: la fila se importa igual,
# nunca se rechaza por falta de estos campos.
DEFAULT_TIPO = "producto"
DEFAULT_MONEDA = "PEN"
DEFAULT_ESTADO = "aprobado_nivel_1"


def validate_and_prepare(
    df: pd.DataFrame, db: Session
) -> tuple[list[Solped], list[Solped], list[dict]]:
    """Valida el DataFrame fila por fila. No hace commit: deja los objetos
    añadidos/modificados en la sesión para que el router decida cuándo
    confirmar la transacción. Solo numero_solped y empresa son obligatorios;
    el resto se completa con valores por defecto si viene vacío."""

    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias en el Excel: {', '.join(missing)}")

    companies_by_key = {}
    for company in db.scalars(select(Company)):
        companies_by_key[normalize_match_key(company.name)] = company
        companies_by_key[normalize_match_key(company.code)] = company
    nombres_empresas_disponibles = ", ".join(sorted({c.name for c in companies_by_key.values()}))

    providers_by_name = {normalize_match_key(p.name): p for p in db.scalars(select(Provider))}
    existing_solpeds = {s.numero_solped.strip(): s for s in db.scalars(select(Solped))}

    to_create: list[Solped] = []
    to_update: list[Solped] = []
    errors: list[dict] = []
    seen_in_file: dict[str, Solped] = {}

    for idx, row in df.iterrows():
        fila = int(idx) + 2  # fila 1 = encabezado, los datos empiezan en la fila 2
        try:
            numero_solped = clean_str(row.get("numero_solped"))
            if not numero_solped:
                numero_solped = f"SIN-NUMERO-F{fila}-{uuid4().hex[:6].upper()}"
            numero_solped = numero_solped.strip()

            empresa_raw = clean_str(row.get("empresa"))
            company_id = None
            if empresa_raw:
                company = companies_by_key.get(normalize_match_key(empresa_raw))
                if not company:
                    raise ValueError(
                        f"empresa no reconocida: '{empresa_raw}'. Empresas disponibles: {nombres_empresas_disponibles}"
                    )
                company_id = company.id

            tipo_raw = clean_str(row.get("tipo"))
            if tipo_raw:
                tipo = tipo_raw.strip().lower()
                if tipo not in TIPOS_VALIDOS:
                    raise ValueError(f"tipo inválido: '{tipo_raw}' (usa PRODUCTO o SERVICIO)")
            else:
                tipo = DEFAULT_TIPO

            descripcion = clean_str(row.get("descripcion"))

            fecha_solped = parse_date_flexible(row.get("fecha_solped")) or date.today()

            proveedor_raw = clean_str(row.get("proveedor"))
            provider = None
            if proveedor_raw:
                provider_key = normalize_match_key(proveedor_raw)
                provider = providers_by_name.get(provider_key)
                if not provider:
                    provider = Provider(name=proveedor_raw)
                    db.add(provider)
                    db.flush()
                    providers_by_name[provider_key] = provider

            numero_orden = clean_str(row.get("numero_orden"))
            monto_orden = parse_decimal_flexible(row.get("monto_orden"), "monto_orden", default=Decimal("0"))

            moneda_raw = clean_str(row.get("moneda"))
            if moneda_raw:
                moneda = moneda_raw.strip().upper()
                if moneda not in MONEDAS_VALIDAS:
                    raise ValueError(f"moneda inválida: '{moneda_raw}' (usa PEN o USD)")
            else:
                moneda = DEFAULT_MONEDA

            estado_raw = clean_str(row.get("estado"))
            if estado_raw:
                estado = estado_raw.strip().lower()
                if estado not in ESTADOS_VALIDOS:
                    raise ValueError(f"estado inválido: '{estado_raw}'")
            else:
                estado = DEFAULT_ESTADO

            presupuestada = parse_bool_flexible(row.get("presupuestada"))
            monto_presupuesto = parse_decimal_flexible(row.get("monto_presupuesto"), "monto_presupuesto")
            monto_ejecutado = parse_decimal_flexible(row.get("monto_ejecutado"), "monto_ejecutado")
            fecha_ejecucion = parse_date_flexible(row.get("fecha_ejecucion"))
            observaciones = clean_str(row.get("observaciones"))

            data = {
                "numero_solped": numero_solped,
                "company_id": company_id,
                "tipo": tipo,
                "descripcion": descripcion,
                "fecha_solped": fecha_solped,
                "provider_id": provider.id if provider else None,
                "numero_orden": numero_orden,
                "monto_orden": monto_orden,
                "moneda": moneda,
                "estado": estado,
                "presupuestada": presupuestada,
                "monto_presupuesto": monto_presupuesto,
                "monto_ejecutado": monto_ejecutado,
                "fecha_ejecucion": fecha_ejecucion,
                "observaciones": observaciones,
            }

            target = seen_in_file.get(numero_solped)
            if target is not None:
                # Segunda ocurrencia del mismo número en el archivo: nos
                # quedamos con los datos más recientes, sin contarlo dos veces.
                for field, value in data.items():
                    setattr(target, field, value)
                continue

            target = existing_solpeds.get(numero_solped)
            if target is not None:
                for field, value in data.items():
                    setattr(target, field, value)
                to_update.append(target)
            else:
                target = Solped(**data)
                db.add(target)
                to_create.append(target)

            seen_in_file[numero_solped] = target

        except ValueError as exc:
            errors.append({"fila": fila, "mensaje": str(exc)})
        except Exception as exc:  # noqa: BLE001
            errors.append({"fila": fila, "mensaje": f"error inesperado: {exc}"})

    return to_create, to_update, errors
